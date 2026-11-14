#!/usr/bin/env node
/** Ejecutar SOLO en base nueva, después de bootstrap del superadmin. */
const baseUrl=String(process.env.BACHE0_API_URL||'http://localhost:3000/api/v1').replace(/\/$/,'');
const vars=['SEED_SUPERADMIN_EMAIL','SEED_SUPERADMIN_PASSWORD'];
const users=[
  ['EC','Estación Central',1,'administrador_municipal'],
  ['LP','La Pintana',2,'administrador_municipal'],
  ['EB','El Bosque',3,'administrador_municipal'],
  ['INS_EC','Inspector de Estación Central',1,'inspector'],
];
for(const [k] of users){ vars.push(`BACHE0_DEMO_${k}_EMAIL`,`BACHE0_DEMO_${k}_PASSWORD`); }
const missing=vars.filter(v=>!process.env[v]);
if(missing.length) {console.error('Faltan variables locales (no subir credenciales):',missing.join(', '));process.exit(1);}
if(!/^https?:\/\//.test(baseUrl)) throw Error('BACHE0_API_URL inválida');
const request=async (url,method,body,token)=>{
 const res=await fetch(baseUrl+url,{method,headers:{'Content-Type':'application/json',...(token?{'Authorization':`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
 let data;try{data=await res.json()}catch{data={}}; return {res,data};
};
const login=await request('/auth/login','POST',{email:process.env.SEED_SUPERADMIN_EMAIL,password:process.env.SEED_SUPERADMIN_PASSWORD});
if(login.res.status!==200) {console.error('Login de superadmin falló (HTTP '+login.res.status+'). Verifica seed e instalación.');process.exit(1);}
const token=login.data?.data?.access_token??login.data?.access_token;
if(!token) throw Error('El login no devolvió un access_token');
const existing=await request('/usuarios?limit=100','GET',null,token);
if(existing.res.status!==200) throw Error('No fue posible listar cuentas para comprobar duplicados');
const map=new Map((existing.data.data||[]).map(x=>[x.email.toLowerCase(),x]));
for(const [key,nombre,municipalidad_id,rol] of users) {
 const email=process.env[`BACHE0_DEMO_${key}_EMAIL`].toLowerCase();
 const password=process.env[`BACHE0_DEMO_${key}_PASSWORD`];
 if(password.length<12||password.length>128) throw Error(`Contraseña de ${key} requiere 12–128 caracteres`);
 const found=map.get(email);
 if(found){
   if(found.rol!==rol||Number(found.municipalidad_id)!==municipalidad_id) throw Error(`Cuenta ${key} existe con rol/municipio incorrecto`);
   console.log('Ya existe y se conserva:',key); continue;
 }
 const response=await request('/usuarios','POST',{nombre,email,password,rol,municipalidad_id},token);
 if(response.res.status!==201) throw Error(`No se creó ${key}: HTTP ${response.res.status}, código ${response.data?.error?.code||'desconocido'}`);
 console.log('Creado:',key,'rol',rol,'municipio',municipalidad_id);
}
console.log('Cuentas de demostración disponibles. Guardar emails/contraseñas SOLO fuera de Git.');
