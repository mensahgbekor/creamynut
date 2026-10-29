import nodemailer from 'npm:nodemailer@6.9.16';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
Deno.serve(async (req: Request) => {
 const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 if(req.method!=='POST')return respond(405,{error:'Use POST'});
 try {
 const {token}=await req.json();if(typeof token!=='string'||!/^[0-9a-f-]{36}$/i.test(token))return respond(400,{error:'Invalid invitation'});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {data:order}=await db.from('orders').select('id,email,order_number,review_email_sent_at').eq('receipt_token',token).eq('status','delivered').not('review_email_requested_at','is',null).maybeSingle();
 if(!order)return respond(404,{error:'Invitation unavailable'});if(order.review_email_sent_at)return respond(200,{sent:true});
 const {data:review}=await db.from('customer_reviews').select('id').eq('order_id',order.id).maybeSingle();if(review)return respond(200,{reviewed:true});
 const claim=new Date().toISOString();const cutoff=new Date(Date.now()-300000).toISOString();
 const {data:claimed,error}=await db.from('orders').update({review_email_claimed_at:claim,review_email_error:null}).eq('id',order.id).is('review_email_sent_at',null).or(`review_email_claimed_at.is.null,review_email_claimed_at.lt.${cutoff}`).select('id').maybeSingle();
 if(error||!claimed)return respond(409,{error:'Invitation already sending'});
 let transport;
 try {
 const user=Deno.env.get('GMAIL_USER');const pass=Deno.env.get('GMAIL_PASS');if(!user||!pass)throw new Error('Email configuration missing');
 const origin=(Deno.env.get('PUBLIC_SITE_URL')||'https://creamynut.vercel.app').replace(/\/$/,'');const link=`${origin}/#ratings?token=${encodeURIComponent(token)}`;
 const number=order.order_number.replace(/[&<>"']/g,'');
 transport=nodemailer.createTransport({service:'gmail',auth:{user,pass},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000});
 await transport.sendMail({from:`CreamyNut <${user}>`,to:order.email,subject:`How was your CreamyNut order ${number}?`,text:`Thank you for choosing CreamyNut. Your order ${number} has been delivered. Rate your experience and leave a review: ${link}\nThis private link allows one review for your order.`,html:`<div style="font-family:Arial;max-width:600px;margin:auto;padding:28px;background:#fdfaf4;color:#33241a"><h1>CreamyNut</h1><h2>How was your order?</h2><p>Thank you for choosing CreamyNut. Your order <strong>${number}</strong> has been delivered.</p><p>We would love to hear what you think.</p><p><a href="${link}" style="display:inline-block;background:#33241a;color:white;padding:14px 24px;border-radius:24px">Rate your order</a></p><p>Your feedback is shared privately with our team. This link allows one review for your order.</p></div>`});
 const {error:saved}=await db.from('orders').update({review_email_sent_at:new Date().toISOString(),review_email_claimed_at:null,review_email_error:null}).eq('id',order.id).eq('review_email_claimed_at',claim);if(saved)throw saved;
 return respond(200,{sent:true});
 }catch{await db.from('orders').update({review_email_claimed_at:null,review_email_error:'Invitation failed; automatic retry pending.'}).eq('id',order.id).eq('review_email_claimed_at',claim);return respond(502,{error:'Invitation delivery failed'});}finally{transport?.close();}
 }catch{return respond(500,{error:'Invitation unavailable'});}
});
