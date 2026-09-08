export type ServiceRequestStatus = 'ASSIGNED' | 'ACCEPTED' | 'ON_THE_WAY' | 'REACHED_SITE' | 'IN_PROGRESS' | 'DIAGNOSIS' | 'REPAIR_IN_PROGRESS' | 'WAITING_FOR_PARTS' | 'TESTING' | 'COMPLETED' | 'CANCELLED';
export interface AssignedJob { id:string; requestId:string; status:ServiceRequestStatus; priority:'LOW'|'MEDIUM'|'HIGH'|'EMERGENCY'; customerName:string; buildingName:string; liftIdentifier:string; issue:string; scheduledAt?:string; }
export interface JobDetail extends AssignedJob { customerPhone?:string; address?:string; issueDescription?:string; expectedDurationMinutes?:number; }
export interface TechnicianDashboard { technicianName:string; serviceArea:string; availability:'AVAILABLE'|'BUSY'|'OFFLINE'; newJobs:number; inProgress:number; completedToday:number; scheduledToday:number; }
