export function createSessionErrorBoundary(React,{jsx:h,jsxs:hs}){
 return class SessionErrorBoundary extends React.Component{
  state={error:null};
  static getDerivedStateFromError(error){return {error};}
  render(){
   if(!this.state.error)return this.props.children;
   return hs('section',{className:'pro-session-page',role:'alert',children:[h('h2',{children:'No se pudo abrir el entrenamiento'}),h('p',{children:'Puedes volver a la lista y reintentarlo. Si vuelve a ocurrir, comparte el detalle del error.'}),h('button',{type:'button',className:'pro-primary-action',onClick:this.props.onBack,children:'Volver a entrenos'}),hs('details',{children:[h('summary',{children:'Detalle del error'}),h('p',{children:String(this.state.error?.message||'Error al mostrar la sesión')})]})]});
  }
 };
}
