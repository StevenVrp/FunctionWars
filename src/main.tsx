import { createRoot } from 'react-dom/client'
import {cloud} from './online/client'
import { App } from './ui/App'
import '@fontsource/archivo-black/latin-400.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-600.css'
import '@fontsource/space-mono/latin-400.css'
import './style.css'
async function launch(){
 const fragment=new URLSearchParams(location.hash.slice(1))
 const returned=fragment.has('access_token')||fragment.has('error')||new URLSearchParams(location.search).has('code')
 if(returned){
  const {data,error}=await cloud().auth.getSession()
  history.replaceState(null,'',location.pathname+'#duel')
  sessionStorage.setItem('fw-confirmation',error||!data.session?'The confirmation link has expired or could not be used. Sign in or request a new email.':'Email confirmed. Your pilot account is ready.')
 }
 createRoot(document.getElementById('root')!).render(<App/>)
}
void launch()
