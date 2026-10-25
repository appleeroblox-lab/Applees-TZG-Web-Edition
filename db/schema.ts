import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const debugAccess=sqliteTable('debug_access',{id:integer('id').primaryKey(),owner:text('owner').notNull(),salt:text('salt').notNull(),hash:text('hash').notNull()});
export const debugSessions=sqliteTable('debug_sessions',{hash:text('hash').primaryKey(),owner:text('owner').notNull(),expires:integer('expires').notNull()});
export const debugLimits=sqliteTable('debug_limits',{owner:text('owner').primaryKey(),attempts:integer('attempts').notNull(),reset:integer('reset').notNull()});
export const debugAudit=sqliteTable('debug_audit',{id:text('id').primaryKey(),owner:text('owner').notNull(),created:integer('created').notNull(),command:text('command').notNull()});
