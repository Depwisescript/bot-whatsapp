import { WASocket, proto } from '@whiskeysockets/baileys';

export interface CommandContext {
    /** The Baileys socket */
    sock: WASocket;
    /** The incoming message */
    message: proto.IWebMessageInfo;
    /** Group JID (only in groups) */
    groupJid: string;
    /** Sender JID */
    senderJid: string;
    /** Parsed arguments after the command name */
    args: string[];
    /** The full text body of the message */
    body: string;
    /** Mentioned JIDs in the message */
    mentionedJids: string[];
    /** Whether the sender is a group admin */
    isAdmin: boolean;
    /** Whether the sender is the bot owner */
    isOwner: boolean;
}

export interface Command {
    /** Command name (without prefix) */
    name: string;
    /** Short description */
    description: string;
    /** Usage example */
    usage: string;
    /** Whether only admins can use this command */
    adminOnly: boolean;
    /** Execute the command */
    execute: (ctx: CommandContext) => Promise<void>;
}

/** Command registry */
const commands = new Map<string, Command>();

export function registerCommand(cmd: Command): void {
    commands.set(cmd.name.toLowerCase(), cmd);
}

export function getCommand(name: string): Command | undefined {
    return commands.get(name.toLowerCase());
}

export function getAllCommands(): Command[] {
    return Array.from(commands.values());
}

// Register all commands
import { registerAdminCommands } from './admin.commands';
import { registerGeneralCommands } from './general.commands';

export function initCommands(): void {
    registerAdminCommands();
    registerGeneralCommands();
}
