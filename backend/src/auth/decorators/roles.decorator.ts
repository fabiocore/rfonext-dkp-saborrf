import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Restringe uma rota a papéis específicos (GM/COUNCIL). Sem uso = qualquer usuário autenticado. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
