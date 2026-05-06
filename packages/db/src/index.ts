import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const globalForDb = globalThis as unknown as {
    db: ReturnType<typeof createDb> | undefined
}

function createDb() {
    const client = postgres(process.env.DATABASE_URL!)
    return drizzle(client, { schema })
}

export const db = globalForDb.db ?? createDb()

if (process.env.NODE_ENV !== 'production') {
    globalForDb.db = db
}

export type DB = typeof db

// Re-export common Drizzle operators so consumers only need to import from '@repo/db'
export {
    eq,
    and,
    or,
    not,
    ne,
    gt,
    gte,
    lt,
    lte,
    inArray,
    notInArray,
    isNull,
    isNotNull,
    count,
    countDistinct,
    sum,
    avg,
    min,
    max,
    asc,
    desc,
    sql,
} from 'drizzle-orm'
export { relations } from 'drizzle-orm'
