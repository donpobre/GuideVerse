const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
import { providerAuthHeaders } from './providerAuth'
async function request(path, options={}) { const response=await fetch(`${API_BASE_URL}${path}`,{...options,headers:{Accept:'application/json',...providerAuthHeaders(),...options.headers}}); if(response.status===204)return null; const body=await response.json().catch(()=>({})); if(!response.ok)throw new Error(typeof body.detail==='string'?body.detail:'Provider request failed'); return body }
export const getPublicProvider = identifier => request(`/api/providers/${encodeURIComponent(identifier)}`)
export const getMyProviderProfile = () => request('/api/provider/profile')
export const updateMyProviderProfile = payload => request('/api/provider/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
export const deleteMyProviderProfile = () => request('/api/provider/profile',{method:'DELETE'})
