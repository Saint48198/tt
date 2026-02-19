import { db } from '../db';

interface Role {
  id: number;
  name: string;
}

class RoleService {
  private static instance: RoleService;

  private constructor() {
    // Private constructor prevents direct instantiation
  }

  public static getInstance(): RoleService {
    if (!RoleService.instance) {
      RoleService.instance = new RoleService();
    }
    return RoleService.instance;
  }

  /**
   * Get all roles
   */
  public getAllRoles(): { roles: Role[] } {
    const roles = db.prepare('SELECT * FROM roles').all() as Role[];
    return { roles };
  }

  /**
   * Get a role by ID
   */
  public getRoleById(id: string | number): Role | undefined {
    return db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as Role | undefined;
  }

  /**
   * Create a new role
   */
  public createRole(name: string): { id: number } {
    if (!name) {
      throw new Error('Role name is required');
    }

    const result = db.prepare('INSERT INTO roles (name) VALUES (?)').run(name);
    return { id: Number(result.lastInsertRowid) };
  }

  /**
   * Update a role
   */
  public updateRole(id: string | number, name: string): { success: boolean; changes: number } {
    const result = db
      .prepare('UPDATE roles SET name = ? WHERE id = ?')
      .run(name, id);

    return {
      success: result.changes > 0,
      changes: result.changes,
    };
  }

  /**
   * Delete a role
   */
  public deleteRole(id: string | number): { success: boolean; changes: number } {
    const result = db.prepare('DELETE FROM roles WHERE id = ?').run(id);

    return {
      success: result.changes > 0,
      changes: result.changes,
    };
  }
}

export const roleService = RoleService.getInstance();

