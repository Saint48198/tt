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
  public async getAllRoles(): Promise<{ roles: Role[] }> {
    const roles = await db.all<Role>('SELECT * FROM roles');
    return { roles };
  }

  /**
   * Get a role by ID
   */
  public async getRoleById(id: string | number): Promise<Role | undefined> {
    return db.get<Role>('SELECT * FROM roles WHERE id = $1', [id]);
  }

  /**
   * Create a new role
   */
  public async createRole(name: string): Promise<{ id: number }> {
    if (!name) throw new Error('Role name is required');
    const result = await db.run('INSERT INTO roles (name) VALUES ($1) RETURNING id', [name]);
    return { id: result.rows[0].id };
  }

  /**
   * Update a role
   */
  public async updateRole(
    id: string | number,
    name: string
  ): Promise<{ success: boolean; changes: number }> {
    const result = await db.run('UPDATE roles SET name = $1 WHERE id = $2', [name, id]);
    return { success: result.rowCount > 0, changes: result.rowCount };
  }

  /**
   * Delete a role
   */
  public async deleteRole(id: string | number): Promise<{ success: boolean; changes: number }> {
    const result = await db.run('DELETE FROM roles WHERE id = $1', [id]);
    return { success: result.rowCount > 0, changes: result.rowCount };
  }
}

export const roleService = RoleService.getInstance();
