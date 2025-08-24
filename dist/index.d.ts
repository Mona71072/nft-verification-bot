import { Client } from 'discord.js';
declare const client: Client<boolean>;
export declare function grantRoleToUser(discordId: string, collectionId?: string, roleName?: string, customMessage?: {
    title?: string;
    description?: string;
    color?: number;
}): Promise<boolean>;
export declare function sendVerificationFailureMessage(discordId: string, verificationData: any): Promise<boolean>;
export declare function revokeRoleFromUser(discordId: string, customMessage?: {
    title?: string;
    description?: string;
    color?: number;
}): Promise<boolean>;
export { client };
