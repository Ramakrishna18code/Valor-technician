import {api} from './client';
import type {AssignedJob,JobDetail,ServiceRequestStatus,TechnicianDashboard} from '../types/technician';
// Align paths/DTOs with the existing Valor backend after source discovery.
export const technicianApi={dashboard:()=>api.get<TechnicianDashboard>('/api/technician/dashboard').then(r=>r.data),jobs:(params?:{page?:number;status?:ServiceRequestStatus})=>api.get<{content:AssignedJob[]}>('/api/technician/jobs',{params}).then(r=>r.data),job:(id:string)=>api.get<JobDetail>(`/api/technician/jobs/${id}`).then(r=>r.data),accept:(id:string)=>api.post<JobDetail>(`/api/technician/jobs/${id}/accept`).then(r=>r.data),transition:(id:string,status:ServiceRequestStatus,notes?:string)=>api.post<JobDetail>(`/api/technician/jobs/${id}/status`,{status,notes}).then(r=>r.data)};
