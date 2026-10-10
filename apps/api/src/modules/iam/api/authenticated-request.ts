import type { Request } from 'express';
import type { SessionIdentity } from '../application/auth.service.js';

export interface AuthenticatedRequest extends Request {
  user: SessionIdentity;
}
