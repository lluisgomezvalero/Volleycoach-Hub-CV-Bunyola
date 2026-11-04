// Account-specific follow-up; never changes browser permissions automatically.
const GEMMA_PROFILE='4d4c0486-9c35-4455-98f1-06e82066fbf3';
export function showPushActivationReminder(profileId,status,dismissed=false){
 return profileId===GEMMA_PROFILE&&!dismissed&&['available','denied','unsupported','ios-install'].includes(status);
}
export function createPushActivationReminder(jsx){
 const h=(tag,props,...children)=>jsx.jsx(tag,children.length?{...props,children:children.length===1?children[0]:children}:(props||{}));
 return function PushActivationReminder({status,busy,error,onActivate,onDismiss,onRecheck}){
  const available=status==='available';
  const copy=available?'Actívalas para recibir los avisos del equipo, RPE y bienestar.':status==='denied'?'Tu navegador tiene las notificaciones bloqueadas. Revisa los permisos de esta web y los ajustes de notificaciones del móvil. Después pulsa «Comprobar permisos».':status==='ios-install'?'En iPhone, añade VolleyCoach Hub a la pantalla de inicio y ábrela desde su icono para activar los avisos.':'Este navegador no permite activar los avisos ahora. Abre la app en un navegador compatible o desde su icono instalado y revisa los permisos del móvil.';
  return h('aside',{className:'push-optin-card',role:'region','aria-label':'Activar notificaciones'},
   h('button',{type:'button',className:'push-optin-close','aria-label':'Cerrar aviso de notificaciones',title:'Cerrar',onClick:onDismiss},'×'),
   h('div',{className:'push-optin-copy'},h('strong',null,'Activa las notificaciones'),h('p',null,copy),error?h('small',{role:'status'},error):null),
   h('button',{type:'button',disabled:busy,onClick:available?onActivate:onRecheck},busy?'Activando…':available?'Activar':'Comprobar permisos'));
 };
}
