
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model Organization
 * 
 */
export type Organization = $Result.DefaultSelection<Prisma.$OrganizationPayload>
/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model ClearanceRequest
 * 
 */
export type ClearanceRequest = $Result.DefaultSelection<Prisma.$ClearanceRequestPayload>
/**
 * Model ClearanceStep
 * 
 */
export type ClearanceStep = $Result.DefaultSelection<Prisma.$ClearanceStepPayload>
/**
 * Model Transaction
 * 
 */
export type Transaction = $Result.DefaultSelection<Prisma.$TransactionPayload>

/**
 * Enums
 */
export namespace $Enums {
  export const Role: {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN',
  OFFICER: 'OFFICER',
  STUDENT: 'STUDENT'
};

export type Role = (typeof Role)[keyof typeof Role]


export const RequestStatus: {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED'
};

export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus]


export const StepStatus: {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

export type StepStatus = (typeof StepStatus)[keyof typeof StepStatus]

}

export type Role = $Enums.Role

export const Role: typeof $Enums.Role

export type RequestStatus = $Enums.RequestStatus

export const RequestStatus: typeof $Enums.RequestStatus

export type StepStatus = $Enums.StepStatus

export const StepStatus: typeof $Enums.StepStatus

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Organizations
 * const organizations = await prisma.organization.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Organizations
   * const organizations = await prisma.organization.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.organization`: Exposes CRUD operations for the **Organization** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Organizations
    * const organizations = await prisma.organization.findMany()
    * ```
    */
  get organization(): Prisma.OrganizationDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.clearanceRequest`: Exposes CRUD operations for the **ClearanceRequest** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ClearanceRequests
    * const clearanceRequests = await prisma.clearanceRequest.findMany()
    * ```
    */
  get clearanceRequest(): Prisma.ClearanceRequestDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.clearanceStep`: Exposes CRUD operations for the **ClearanceStep** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ClearanceSteps
    * const clearanceSteps = await prisma.clearanceStep.findMany()
    * ```
    */
  get clearanceStep(): Prisma.ClearanceStepDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.transaction`: Exposes CRUD operations for the **Transaction** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Transactions
    * const transactions = await prisma.transaction.findMany()
    * ```
    */
  get transaction(): Prisma.TransactionDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.12.0
   * Query Engine version: 8047c96bbd92db98a2abc7c9323ce77c02c89dbc
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Organization: 'Organization',
    User: 'User',
    ClearanceRequest: 'ClearanceRequest',
    ClearanceStep: 'ClearanceStep',
    Transaction: 'Transaction'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "organization" | "user" | "clearanceRequest" | "clearanceStep" | "transaction"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      Organization: {
        payload: Prisma.$OrganizationPayload<ExtArgs>
        fields: Prisma.OrganizationFieldRefs
        operations: {
          findUnique: {
            args: Prisma.OrganizationFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.OrganizationFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>
          }
          findFirst: {
            args: Prisma.OrganizationFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.OrganizationFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>
          }
          findMany: {
            args: Prisma.OrganizationFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>[]
          }
          create: {
            args: Prisma.OrganizationCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>
          }
          createMany: {
            args: Prisma.OrganizationCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.OrganizationCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>[]
          }
          delete: {
            args: Prisma.OrganizationDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>
          }
          update: {
            args: Prisma.OrganizationUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>
          }
          deleteMany: {
            args: Prisma.OrganizationDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.OrganizationUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.OrganizationUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>[]
          }
          upsert: {
            args: Prisma.OrganizationUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OrganizationPayload>
          }
          aggregate: {
            args: Prisma.OrganizationAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateOrganization>
          }
          groupBy: {
            args: Prisma.OrganizationGroupByArgs<ExtArgs>
            result: $Utils.Optional<OrganizationGroupByOutputType>[]
          }
          count: {
            args: Prisma.OrganizationCountArgs<ExtArgs>
            result: $Utils.Optional<OrganizationCountAggregateOutputType> | number
          }
        }
      }
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      ClearanceRequest: {
        payload: Prisma.$ClearanceRequestPayload<ExtArgs>
        fields: Prisma.ClearanceRequestFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ClearanceRequestFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceRequestPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ClearanceRequestFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceRequestPayload>
          }
          findFirst: {
            args: Prisma.ClearanceRequestFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceRequestPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ClearanceRequestFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceRequestPayload>
          }
          findMany: {
            args: Prisma.ClearanceRequestFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceRequestPayload>[]
          }
          create: {
            args: Prisma.ClearanceRequestCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceRequestPayload>
          }
          createMany: {
            args: Prisma.ClearanceRequestCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ClearanceRequestCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceRequestPayload>[]
          }
          delete: {
            args: Prisma.ClearanceRequestDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceRequestPayload>
          }
          update: {
            args: Prisma.ClearanceRequestUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceRequestPayload>
          }
          deleteMany: {
            args: Prisma.ClearanceRequestDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ClearanceRequestUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ClearanceRequestUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceRequestPayload>[]
          }
          upsert: {
            args: Prisma.ClearanceRequestUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceRequestPayload>
          }
          aggregate: {
            args: Prisma.ClearanceRequestAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateClearanceRequest>
          }
          groupBy: {
            args: Prisma.ClearanceRequestGroupByArgs<ExtArgs>
            result: $Utils.Optional<ClearanceRequestGroupByOutputType>[]
          }
          count: {
            args: Prisma.ClearanceRequestCountArgs<ExtArgs>
            result: $Utils.Optional<ClearanceRequestCountAggregateOutputType> | number
          }
        }
      }
      ClearanceStep: {
        payload: Prisma.$ClearanceStepPayload<ExtArgs>
        fields: Prisma.ClearanceStepFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ClearanceStepFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceStepPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ClearanceStepFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceStepPayload>
          }
          findFirst: {
            args: Prisma.ClearanceStepFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceStepPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ClearanceStepFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceStepPayload>
          }
          findMany: {
            args: Prisma.ClearanceStepFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceStepPayload>[]
          }
          create: {
            args: Prisma.ClearanceStepCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceStepPayload>
          }
          createMany: {
            args: Prisma.ClearanceStepCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ClearanceStepCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceStepPayload>[]
          }
          delete: {
            args: Prisma.ClearanceStepDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceStepPayload>
          }
          update: {
            args: Prisma.ClearanceStepUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceStepPayload>
          }
          deleteMany: {
            args: Prisma.ClearanceStepDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ClearanceStepUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ClearanceStepUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceStepPayload>[]
          }
          upsert: {
            args: Prisma.ClearanceStepUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClearanceStepPayload>
          }
          aggregate: {
            args: Prisma.ClearanceStepAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateClearanceStep>
          }
          groupBy: {
            args: Prisma.ClearanceStepGroupByArgs<ExtArgs>
            result: $Utils.Optional<ClearanceStepGroupByOutputType>[]
          }
          count: {
            args: Prisma.ClearanceStepCountArgs<ExtArgs>
            result: $Utils.Optional<ClearanceStepCountAggregateOutputType> | number
          }
        }
      }
      Transaction: {
        payload: Prisma.$TransactionPayload<ExtArgs>
        fields: Prisma.TransactionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TransactionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TransactionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          findFirst: {
            args: Prisma.TransactionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TransactionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          findMany: {
            args: Prisma.TransactionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>[]
          }
          create: {
            args: Prisma.TransactionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          createMany: {
            args: Prisma.TransactionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TransactionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>[]
          }
          delete: {
            args: Prisma.TransactionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          update: {
            args: Prisma.TransactionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          deleteMany: {
            args: Prisma.TransactionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TransactionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TransactionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>[]
          }
          upsert: {
            args: Prisma.TransactionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          aggregate: {
            args: Prisma.TransactionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTransaction>
          }
          groupBy: {
            args: Prisma.TransactionGroupByArgs<ExtArgs>
            result: $Utils.Optional<TransactionGroupByOutputType>[]
          }
          count: {
            args: Prisma.TransactionCountArgs<ExtArgs>
            result: $Utils.Optional<TransactionCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    organization?: OrganizationOmit
    user?: UserOmit
    clearanceRequest?: ClearanceRequestOmit
    clearanceStep?: ClearanceStepOmit
    transaction?: TransactionOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type OrganizationCountOutputType
   */

  export type OrganizationCountOutputType = {
    users: number
    clearances: number
  }

  export type OrganizationCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    users?: boolean | OrganizationCountOutputTypeCountUsersArgs
    clearances?: boolean | OrganizationCountOutputTypeCountClearancesArgs
  }

  // Custom InputTypes
  /**
   * OrganizationCountOutputType without action
   */
  export type OrganizationCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrganizationCountOutputType
     */
    select?: OrganizationCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * OrganizationCountOutputType without action
   */
  export type OrganizationCountOutputTypeCountUsersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
  }

  /**
   * OrganizationCountOutputType without action
   */
  export type OrganizationCountOutputTypeCountClearancesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClearanceRequestWhereInput
  }


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    clearances: number
    stepsApproved: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    clearances?: boolean | UserCountOutputTypeCountClearancesArgs
    stepsApproved?: boolean | UserCountOutputTypeCountStepsApprovedArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountClearancesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClearanceRequestWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountStepsApprovedArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClearanceStepWhereInput
  }


  /**
   * Count Type ClearanceRequestCountOutputType
   */

  export type ClearanceRequestCountOutputType = {
    steps: number
    transactions: number
  }

  export type ClearanceRequestCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    steps?: boolean | ClearanceRequestCountOutputTypeCountStepsArgs
    transactions?: boolean | ClearanceRequestCountOutputTypeCountTransactionsArgs
  }

  // Custom InputTypes
  /**
   * ClearanceRequestCountOutputType without action
   */
  export type ClearanceRequestCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceRequestCountOutputType
     */
    select?: ClearanceRequestCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * ClearanceRequestCountOutputType without action
   */
  export type ClearanceRequestCountOutputTypeCountStepsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClearanceStepWhereInput
  }

  /**
   * ClearanceRequestCountOutputType without action
   */
  export type ClearanceRequestCountOutputTypeCountTransactionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TransactionWhereInput
  }


  /**
   * Models
   */

  /**
   * Model Organization
   */

  export type AggregateOrganization = {
    _count: OrganizationCountAggregateOutputType | null
    _min: OrganizationMinAggregateOutputType | null
    _max: OrganizationMaxAggregateOutputType | null
  }

  export type OrganizationMinAggregateOutputType = {
    id: string | null
    name: string | null
    subdomain: string | null
    createdAt: Date | null
  }

  export type OrganizationMaxAggregateOutputType = {
    id: string | null
    name: string | null
    subdomain: string | null
    createdAt: Date | null
  }

  export type OrganizationCountAggregateOutputType = {
    id: number
    name: number
    subdomain: number
    createdAt: number
    _all: number
  }


  export type OrganizationMinAggregateInputType = {
    id?: true
    name?: true
    subdomain?: true
    createdAt?: true
  }

  export type OrganizationMaxAggregateInputType = {
    id?: true
    name?: true
    subdomain?: true
    createdAt?: true
  }

  export type OrganizationCountAggregateInputType = {
    id?: true
    name?: true
    subdomain?: true
    createdAt?: true
    _all?: true
  }

  export type OrganizationAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Organization to aggregate.
     */
    where?: OrganizationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Organizations to fetch.
     */
    orderBy?: OrganizationOrderByWithRelationInput | OrganizationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: OrganizationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Organizations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Organizations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Organizations
    **/
    _count?: true | OrganizationCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: OrganizationMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: OrganizationMaxAggregateInputType
  }

  export type GetOrganizationAggregateType<T extends OrganizationAggregateArgs> = {
        [P in keyof T & keyof AggregateOrganization]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateOrganization[P]>
      : GetScalarType<T[P], AggregateOrganization[P]>
  }




  export type OrganizationGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: OrganizationWhereInput
    orderBy?: OrganizationOrderByWithAggregationInput | OrganizationOrderByWithAggregationInput[]
    by: OrganizationScalarFieldEnum[] | OrganizationScalarFieldEnum
    having?: OrganizationScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: OrganizationCountAggregateInputType | true
    _min?: OrganizationMinAggregateInputType
    _max?: OrganizationMaxAggregateInputType
  }

  export type OrganizationGroupByOutputType = {
    id: string
    name: string
    subdomain: string
    createdAt: Date
    _count: OrganizationCountAggregateOutputType | null
    _min: OrganizationMinAggregateOutputType | null
    _max: OrganizationMaxAggregateOutputType | null
  }

  type GetOrganizationGroupByPayload<T extends OrganizationGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<OrganizationGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof OrganizationGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], OrganizationGroupByOutputType[P]>
            : GetScalarType<T[P], OrganizationGroupByOutputType[P]>
        }
      >
    >


  export type OrganizationSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    subdomain?: boolean
    createdAt?: boolean
    users?: boolean | Organization$usersArgs<ExtArgs>
    clearances?: boolean | Organization$clearancesArgs<ExtArgs>
    _count?: boolean | OrganizationCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["organization"]>

  export type OrganizationSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    subdomain?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["organization"]>

  export type OrganizationSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    subdomain?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["organization"]>

  export type OrganizationSelectScalar = {
    id?: boolean
    name?: boolean
    subdomain?: boolean
    createdAt?: boolean
  }

  export type OrganizationOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "subdomain" | "createdAt", ExtArgs["result"]["organization"]>
  export type OrganizationInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    users?: boolean | Organization$usersArgs<ExtArgs>
    clearances?: boolean | Organization$clearancesArgs<ExtArgs>
    _count?: boolean | OrganizationCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type OrganizationIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type OrganizationIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $OrganizationPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Organization"
    objects: {
      users: Prisma.$UserPayload<ExtArgs>[]
      clearances: Prisma.$ClearanceRequestPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      subdomain: string
      createdAt: Date
    }, ExtArgs["result"]["organization"]>
    composites: {}
  }

  type OrganizationGetPayload<S extends boolean | null | undefined | OrganizationDefaultArgs> = $Result.GetResult<Prisma.$OrganizationPayload, S>

  type OrganizationCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<OrganizationFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: OrganizationCountAggregateInputType | true
    }

  export interface OrganizationDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Organization'], meta: { name: 'Organization' } }
    /**
     * Find zero or one Organization that matches the filter.
     * @param {OrganizationFindUniqueArgs} args - Arguments to find a Organization
     * @example
     * // Get one Organization
     * const organization = await prisma.organization.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends OrganizationFindUniqueArgs>(args: SelectSubset<T, OrganizationFindUniqueArgs<ExtArgs>>): Prisma__OrganizationClient<$Result.GetResult<Prisma.$OrganizationPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Organization that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {OrganizationFindUniqueOrThrowArgs} args - Arguments to find a Organization
     * @example
     * // Get one Organization
     * const organization = await prisma.organization.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends OrganizationFindUniqueOrThrowArgs>(args: SelectSubset<T, OrganizationFindUniqueOrThrowArgs<ExtArgs>>): Prisma__OrganizationClient<$Result.GetResult<Prisma.$OrganizationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Organization that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationFindFirstArgs} args - Arguments to find a Organization
     * @example
     * // Get one Organization
     * const organization = await prisma.organization.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends OrganizationFindFirstArgs>(args?: SelectSubset<T, OrganizationFindFirstArgs<ExtArgs>>): Prisma__OrganizationClient<$Result.GetResult<Prisma.$OrganizationPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Organization that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationFindFirstOrThrowArgs} args - Arguments to find a Organization
     * @example
     * // Get one Organization
     * const organization = await prisma.organization.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends OrganizationFindFirstOrThrowArgs>(args?: SelectSubset<T, OrganizationFindFirstOrThrowArgs<ExtArgs>>): Prisma__OrganizationClient<$Result.GetResult<Prisma.$OrganizationPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Organizations that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Organizations
     * const organizations = await prisma.organization.findMany()
     * 
     * // Get first 10 Organizations
     * const organizations = await prisma.organization.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const organizationWithIdOnly = await prisma.organization.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends OrganizationFindManyArgs>(args?: SelectSubset<T, OrganizationFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrganizationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Organization.
     * @param {OrganizationCreateArgs} args - Arguments to create a Organization.
     * @example
     * // Create one Organization
     * const Organization = await prisma.organization.create({
     *   data: {
     *     // ... data to create a Organization
     *   }
     * })
     * 
     */
    create<T extends OrganizationCreateArgs>(args: SelectSubset<T, OrganizationCreateArgs<ExtArgs>>): Prisma__OrganizationClient<$Result.GetResult<Prisma.$OrganizationPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Organizations.
     * @param {OrganizationCreateManyArgs} args - Arguments to create many Organizations.
     * @example
     * // Create many Organizations
     * const organization = await prisma.organization.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends OrganizationCreateManyArgs>(args?: SelectSubset<T, OrganizationCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Organizations and returns the data saved in the database.
     * @param {OrganizationCreateManyAndReturnArgs} args - Arguments to create many Organizations.
     * @example
     * // Create many Organizations
     * const organization = await prisma.organization.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Organizations and only return the `id`
     * const organizationWithIdOnly = await prisma.organization.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends OrganizationCreateManyAndReturnArgs>(args?: SelectSubset<T, OrganizationCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrganizationPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Organization.
     * @param {OrganizationDeleteArgs} args - Arguments to delete one Organization.
     * @example
     * // Delete one Organization
     * const Organization = await prisma.organization.delete({
     *   where: {
     *     // ... filter to delete one Organization
     *   }
     * })
     * 
     */
    delete<T extends OrganizationDeleteArgs>(args: SelectSubset<T, OrganizationDeleteArgs<ExtArgs>>): Prisma__OrganizationClient<$Result.GetResult<Prisma.$OrganizationPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Organization.
     * @param {OrganizationUpdateArgs} args - Arguments to update one Organization.
     * @example
     * // Update one Organization
     * const organization = await prisma.organization.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends OrganizationUpdateArgs>(args: SelectSubset<T, OrganizationUpdateArgs<ExtArgs>>): Prisma__OrganizationClient<$Result.GetResult<Prisma.$OrganizationPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Organizations.
     * @param {OrganizationDeleteManyArgs} args - Arguments to filter Organizations to delete.
     * @example
     * // Delete a few Organizations
     * const { count } = await prisma.organization.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends OrganizationDeleteManyArgs>(args?: SelectSubset<T, OrganizationDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Organizations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Organizations
     * const organization = await prisma.organization.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends OrganizationUpdateManyArgs>(args: SelectSubset<T, OrganizationUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Organizations and returns the data updated in the database.
     * @param {OrganizationUpdateManyAndReturnArgs} args - Arguments to update many Organizations.
     * @example
     * // Update many Organizations
     * const organization = await prisma.organization.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Organizations and only return the `id`
     * const organizationWithIdOnly = await prisma.organization.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends OrganizationUpdateManyAndReturnArgs>(args: SelectSubset<T, OrganizationUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OrganizationPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Organization.
     * @param {OrganizationUpsertArgs} args - Arguments to update or create a Organization.
     * @example
     * // Update or create a Organization
     * const organization = await prisma.organization.upsert({
     *   create: {
     *     // ... data to create a Organization
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Organization we want to update
     *   }
     * })
     */
    upsert<T extends OrganizationUpsertArgs>(args: SelectSubset<T, OrganizationUpsertArgs<ExtArgs>>): Prisma__OrganizationClient<$Result.GetResult<Prisma.$OrganizationPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Organizations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationCountArgs} args - Arguments to filter Organizations to count.
     * @example
     * // Count the number of Organizations
     * const count = await prisma.organization.count({
     *   where: {
     *     // ... the filter for the Organizations we want to count
     *   }
     * })
    **/
    count<T extends OrganizationCountArgs>(
      args?: Subset<T, OrganizationCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], OrganizationCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Organization.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends OrganizationAggregateArgs>(args: Subset<T, OrganizationAggregateArgs>): Prisma.PrismaPromise<GetOrganizationAggregateType<T>>

    /**
     * Group by Organization.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrganizationGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends OrganizationGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: OrganizationGroupByArgs['orderBy'] }
        : { orderBy?: OrganizationGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, OrganizationGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetOrganizationGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Organization model
   */
  readonly fields: OrganizationFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Organization.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__OrganizationClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    users<T extends Organization$usersArgs<ExtArgs> = {}>(args?: Subset<T, Organization$usersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    clearances<T extends Organization$clearancesArgs<ExtArgs> = {}>(args?: Subset<T, Organization$clearancesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClearanceRequestPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Organization model
   */
  interface OrganizationFieldRefs {
    readonly id: FieldRef<"Organization", 'String'>
    readonly name: FieldRef<"Organization", 'String'>
    readonly subdomain: FieldRef<"Organization", 'String'>
    readonly createdAt: FieldRef<"Organization", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Organization findUnique
   */
  export type OrganizationFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null
    /**
     * Filter, which Organization to fetch.
     */
    where: OrganizationWhereUniqueInput
  }

  /**
   * Organization findUniqueOrThrow
   */
  export type OrganizationFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null
    /**
     * Filter, which Organization to fetch.
     */
    where: OrganizationWhereUniqueInput
  }

  /**
   * Organization findFirst
   */
  export type OrganizationFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null
    /**
     * Filter, which Organization to fetch.
     */
    where?: OrganizationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Organizations to fetch.
     */
    orderBy?: OrganizationOrderByWithRelationInput | OrganizationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Organizations.
     */
    cursor?: OrganizationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Organizations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Organizations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Organizations.
     */
    distinct?: OrganizationScalarFieldEnum | OrganizationScalarFieldEnum[]
  }

  /**
   * Organization findFirstOrThrow
   */
  export type OrganizationFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null
    /**
     * Filter, which Organization to fetch.
     */
    where?: OrganizationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Organizations to fetch.
     */
    orderBy?: OrganizationOrderByWithRelationInput | OrganizationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Organizations.
     */
    cursor?: OrganizationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Organizations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Organizations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Organizations.
     */
    distinct?: OrganizationScalarFieldEnum | OrganizationScalarFieldEnum[]
  }

  /**
   * Organization findMany
   */
  export type OrganizationFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null
    /**
     * Filter, which Organizations to fetch.
     */
    where?: OrganizationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Organizations to fetch.
     */
    orderBy?: OrganizationOrderByWithRelationInput | OrganizationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Organizations.
     */
    cursor?: OrganizationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Organizations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Organizations.
     */
    skip?: number
    distinct?: OrganizationScalarFieldEnum | OrganizationScalarFieldEnum[]
  }

  /**
   * Organization create
   */
  export type OrganizationCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null
    /**
     * The data needed to create a Organization.
     */
    data: XOR<OrganizationCreateInput, OrganizationUncheckedCreateInput>
  }

  /**
   * Organization createMany
   */
  export type OrganizationCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Organizations.
     */
    data: OrganizationCreateManyInput | OrganizationCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Organization createManyAndReturn
   */
  export type OrganizationCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null
    /**
     * The data used to create many Organizations.
     */
    data: OrganizationCreateManyInput | OrganizationCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Organization update
   */
  export type OrganizationUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null
    /**
     * The data needed to update a Organization.
     */
    data: XOR<OrganizationUpdateInput, OrganizationUncheckedUpdateInput>
    /**
     * Choose, which Organization to update.
     */
    where: OrganizationWhereUniqueInput
  }

  /**
   * Organization updateMany
   */
  export type OrganizationUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Organizations.
     */
    data: XOR<OrganizationUpdateManyMutationInput, OrganizationUncheckedUpdateManyInput>
    /**
     * Filter which Organizations to update
     */
    where?: OrganizationWhereInput
    /**
     * Limit how many Organizations to update.
     */
    limit?: number
  }

  /**
   * Organization updateManyAndReturn
   */
  export type OrganizationUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null
    /**
     * The data used to update Organizations.
     */
    data: XOR<OrganizationUpdateManyMutationInput, OrganizationUncheckedUpdateManyInput>
    /**
     * Filter which Organizations to update
     */
    where?: OrganizationWhereInput
    /**
     * Limit how many Organizations to update.
     */
    limit?: number
  }

  /**
   * Organization upsert
   */
  export type OrganizationUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null
    /**
     * The filter to search for the Organization to update in case it exists.
     */
    where: OrganizationWhereUniqueInput
    /**
     * In case the Organization found by the `where` argument doesn't exist, create a new Organization with this data.
     */
    create: XOR<OrganizationCreateInput, OrganizationUncheckedCreateInput>
    /**
     * In case the Organization was found with the provided `where` argument, update it with this data.
     */
    update: XOR<OrganizationUpdateInput, OrganizationUncheckedUpdateInput>
  }

  /**
   * Organization delete
   */
  export type OrganizationDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null
    /**
     * Filter which Organization to delete.
     */
    where: OrganizationWhereUniqueInput
  }

  /**
   * Organization deleteMany
   */
  export type OrganizationDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Organizations to delete
     */
    where?: OrganizationWhereInput
    /**
     * Limit how many Organizations to delete.
     */
    limit?: number
  }

  /**
   * Organization.users
   */
  export type Organization$usersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    cursor?: UserWhereUniqueInput
    take?: number
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * Organization.clearances
   */
  export type Organization$clearancesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceRequest
     */
    select?: ClearanceRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceRequest
     */
    omit?: ClearanceRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceRequestInclude<ExtArgs> | null
    where?: ClearanceRequestWhereInput
    orderBy?: ClearanceRequestOrderByWithRelationInput | ClearanceRequestOrderByWithRelationInput[]
    cursor?: ClearanceRequestWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ClearanceRequestScalarFieldEnum | ClearanceRequestScalarFieldEnum[]
  }

  /**
   * Organization without action
   */
  export type OrganizationDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Organization
     */
    select?: OrganizationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Organization
     */
    omit?: OrganizationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OrganizationInclude<ExtArgs> | null
  }


  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    email: string | null
    name: string | null
    studentId: string | null
    role: $Enums.Role | null
    organizationId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    email: string | null
    name: string | null
    studentId: string | null
    role: $Enums.Role | null
    organizationId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    email: number
    name: number
    studentId: number
    role: number
    organizationId: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    id?: true
    email?: true
    name?: true
    studentId?: true
    role?: true
    organizationId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    email?: true
    name?: true
    studentId?: true
    role?: true
    organizationId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    email?: true
    name?: true
    studentId?: true
    role?: true
    organizationId?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: string
    email: string
    name: string
    studentId: string | null
    role: $Enums.Role
    organizationId: string
    createdAt: Date
    updatedAt: Date
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    name?: boolean
    studentId?: boolean
    role?: boolean
    organizationId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>
    clearances?: boolean | User$clearancesArgs<ExtArgs>
    stepsApproved?: boolean | User$stepsApprovedArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    name?: boolean
    studentId?: boolean
    role?: boolean
    organizationId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    name?: boolean
    studentId?: boolean
    role?: boolean
    organizationId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    email?: boolean
    name?: boolean
    studentId?: boolean
    role?: boolean
    organizationId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "email" | "name" | "studentId" | "role" | "organizationId" | "createdAt" | "updatedAt", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>
    clearances?: boolean | User$clearancesArgs<ExtArgs>
    stepsApproved?: boolean | User$stepsApprovedArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>
  }
  export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>
  }

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      organization: Prisma.$OrganizationPayload<ExtArgs>
      clearances: Prisma.$ClearanceRequestPayload<ExtArgs>[]
      stepsApproved: Prisma.$ClearanceStepPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      email: string
      name: string
      studentId: string | null
      role: $Enums.Role
      organizationId: string
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    organization<T extends OrganizationDefaultArgs<ExtArgs> = {}>(args?: Subset<T, OrganizationDefaultArgs<ExtArgs>>): Prisma__OrganizationClient<$Result.GetResult<Prisma.$OrganizationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    clearances<T extends User$clearancesArgs<ExtArgs> = {}>(args?: Subset<T, User$clearancesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClearanceRequestPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    stepsApproved<T extends User$stepsApprovedArgs<ExtArgs> = {}>(args?: Subset<T, User$stepsApprovedArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClearanceStepPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly name: FieldRef<"User", 'String'>
    readonly studentId: FieldRef<"User", 'String'>
    readonly role: FieldRef<"User", 'Role'>
    readonly organizationId: FieldRef<"User", 'String'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User.clearances
   */
  export type User$clearancesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceRequest
     */
    select?: ClearanceRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceRequest
     */
    omit?: ClearanceRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceRequestInclude<ExtArgs> | null
    where?: ClearanceRequestWhereInput
    orderBy?: ClearanceRequestOrderByWithRelationInput | ClearanceRequestOrderByWithRelationInput[]
    cursor?: ClearanceRequestWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ClearanceRequestScalarFieldEnum | ClearanceRequestScalarFieldEnum[]
  }

  /**
   * User.stepsApproved
   */
  export type User$stepsApprovedArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceStep
     */
    select?: ClearanceStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceStep
     */
    omit?: ClearanceStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceStepInclude<ExtArgs> | null
    where?: ClearanceStepWhereInput
    orderBy?: ClearanceStepOrderByWithRelationInput | ClearanceStepOrderByWithRelationInput[]
    cursor?: ClearanceStepWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ClearanceStepScalarFieldEnum | ClearanceStepScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model ClearanceRequest
   */

  export type AggregateClearanceRequest = {
    _count: ClearanceRequestCountAggregateOutputType | null
    _min: ClearanceRequestMinAggregateOutputType | null
    _max: ClearanceRequestMaxAggregateOutputType | null
  }

  export type ClearanceRequestMinAggregateOutputType = {
    id: string | null
    academicYear: string | null
    semester: string | null
    status: $Enums.RequestStatus | null
    qrPayload: string | null
    organizationId: string | null
    studentId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ClearanceRequestMaxAggregateOutputType = {
    id: string | null
    academicYear: string | null
    semester: string | null
    status: $Enums.RequestStatus | null
    qrPayload: string | null
    organizationId: string | null
    studentId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ClearanceRequestCountAggregateOutputType = {
    id: number
    academicYear: number
    semester: number
    status: number
    qrPayload: number
    organizationId: number
    studentId: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ClearanceRequestMinAggregateInputType = {
    id?: true
    academicYear?: true
    semester?: true
    status?: true
    qrPayload?: true
    organizationId?: true
    studentId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ClearanceRequestMaxAggregateInputType = {
    id?: true
    academicYear?: true
    semester?: true
    status?: true
    qrPayload?: true
    organizationId?: true
    studentId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ClearanceRequestCountAggregateInputType = {
    id?: true
    academicYear?: true
    semester?: true
    status?: true
    qrPayload?: true
    organizationId?: true
    studentId?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ClearanceRequestAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ClearanceRequest to aggregate.
     */
    where?: ClearanceRequestWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClearanceRequests to fetch.
     */
    orderBy?: ClearanceRequestOrderByWithRelationInput | ClearanceRequestOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ClearanceRequestWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClearanceRequests from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClearanceRequests.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ClearanceRequests
    **/
    _count?: true | ClearanceRequestCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ClearanceRequestMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ClearanceRequestMaxAggregateInputType
  }

  export type GetClearanceRequestAggregateType<T extends ClearanceRequestAggregateArgs> = {
        [P in keyof T & keyof AggregateClearanceRequest]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateClearanceRequest[P]>
      : GetScalarType<T[P], AggregateClearanceRequest[P]>
  }




  export type ClearanceRequestGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClearanceRequestWhereInput
    orderBy?: ClearanceRequestOrderByWithAggregationInput | ClearanceRequestOrderByWithAggregationInput[]
    by: ClearanceRequestScalarFieldEnum[] | ClearanceRequestScalarFieldEnum
    having?: ClearanceRequestScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ClearanceRequestCountAggregateInputType | true
    _min?: ClearanceRequestMinAggregateInputType
    _max?: ClearanceRequestMaxAggregateInputType
  }

  export type ClearanceRequestGroupByOutputType = {
    id: string
    academicYear: string
    semester: string
    status: $Enums.RequestStatus
    qrPayload: string | null
    organizationId: string
    studentId: string
    createdAt: Date
    updatedAt: Date
    _count: ClearanceRequestCountAggregateOutputType | null
    _min: ClearanceRequestMinAggregateOutputType | null
    _max: ClearanceRequestMaxAggregateOutputType | null
  }

  type GetClearanceRequestGroupByPayload<T extends ClearanceRequestGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ClearanceRequestGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ClearanceRequestGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ClearanceRequestGroupByOutputType[P]>
            : GetScalarType<T[P], ClearanceRequestGroupByOutputType[P]>
        }
      >
    >


  export type ClearanceRequestSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    academicYear?: boolean
    semester?: boolean
    status?: boolean
    qrPayload?: boolean
    organizationId?: boolean
    studentId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>
    student?: boolean | UserDefaultArgs<ExtArgs>
    steps?: boolean | ClearanceRequest$stepsArgs<ExtArgs>
    transactions?: boolean | ClearanceRequest$transactionsArgs<ExtArgs>
    _count?: boolean | ClearanceRequestCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["clearanceRequest"]>

  export type ClearanceRequestSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    academicYear?: boolean
    semester?: boolean
    status?: boolean
    qrPayload?: boolean
    organizationId?: boolean
    studentId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>
    student?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["clearanceRequest"]>

  export type ClearanceRequestSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    academicYear?: boolean
    semester?: boolean
    status?: boolean
    qrPayload?: boolean
    organizationId?: boolean
    studentId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>
    student?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["clearanceRequest"]>

  export type ClearanceRequestSelectScalar = {
    id?: boolean
    academicYear?: boolean
    semester?: boolean
    status?: boolean
    qrPayload?: boolean
    organizationId?: boolean
    studentId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ClearanceRequestOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "academicYear" | "semester" | "status" | "qrPayload" | "organizationId" | "studentId" | "createdAt" | "updatedAt", ExtArgs["result"]["clearanceRequest"]>
  export type ClearanceRequestInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>
    student?: boolean | UserDefaultArgs<ExtArgs>
    steps?: boolean | ClearanceRequest$stepsArgs<ExtArgs>
    transactions?: boolean | ClearanceRequest$transactionsArgs<ExtArgs>
    _count?: boolean | ClearanceRequestCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type ClearanceRequestIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>
    student?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type ClearanceRequestIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    organization?: boolean | OrganizationDefaultArgs<ExtArgs>
    student?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $ClearanceRequestPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ClearanceRequest"
    objects: {
      organization: Prisma.$OrganizationPayload<ExtArgs>
      student: Prisma.$UserPayload<ExtArgs>
      steps: Prisma.$ClearanceStepPayload<ExtArgs>[]
      transactions: Prisma.$TransactionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      academicYear: string
      semester: string
      status: $Enums.RequestStatus
      qrPayload: string | null
      organizationId: string
      studentId: string
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["clearanceRequest"]>
    composites: {}
  }

  type ClearanceRequestGetPayload<S extends boolean | null | undefined | ClearanceRequestDefaultArgs> = $Result.GetResult<Prisma.$ClearanceRequestPayload, S>

  type ClearanceRequestCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ClearanceRequestFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ClearanceRequestCountAggregateInputType | true
    }

  export interface ClearanceRequestDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ClearanceRequest'], meta: { name: 'ClearanceRequest' } }
    /**
     * Find zero or one ClearanceRequest that matches the filter.
     * @param {ClearanceRequestFindUniqueArgs} args - Arguments to find a ClearanceRequest
     * @example
     * // Get one ClearanceRequest
     * const clearanceRequest = await prisma.clearanceRequest.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ClearanceRequestFindUniqueArgs>(args: SelectSubset<T, ClearanceRequestFindUniqueArgs<ExtArgs>>): Prisma__ClearanceRequestClient<$Result.GetResult<Prisma.$ClearanceRequestPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ClearanceRequest that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ClearanceRequestFindUniqueOrThrowArgs} args - Arguments to find a ClearanceRequest
     * @example
     * // Get one ClearanceRequest
     * const clearanceRequest = await prisma.clearanceRequest.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ClearanceRequestFindUniqueOrThrowArgs>(args: SelectSubset<T, ClearanceRequestFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ClearanceRequestClient<$Result.GetResult<Prisma.$ClearanceRequestPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ClearanceRequest that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClearanceRequestFindFirstArgs} args - Arguments to find a ClearanceRequest
     * @example
     * // Get one ClearanceRequest
     * const clearanceRequest = await prisma.clearanceRequest.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ClearanceRequestFindFirstArgs>(args?: SelectSubset<T, ClearanceRequestFindFirstArgs<ExtArgs>>): Prisma__ClearanceRequestClient<$Result.GetResult<Prisma.$ClearanceRequestPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ClearanceRequest that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClearanceRequestFindFirstOrThrowArgs} args - Arguments to find a ClearanceRequest
     * @example
     * // Get one ClearanceRequest
     * const clearanceRequest = await prisma.clearanceRequest.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ClearanceRequestFindFirstOrThrowArgs>(args?: SelectSubset<T, ClearanceRequestFindFirstOrThrowArgs<ExtArgs>>): Prisma__ClearanceRequestClient<$Result.GetResult<Prisma.$ClearanceRequestPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ClearanceRequests that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClearanceRequestFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ClearanceRequests
     * const clearanceRequests = await prisma.clearanceRequest.findMany()
     * 
     * // Get first 10 ClearanceRequests
     * const clearanceRequests = await prisma.clearanceRequest.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const clearanceRequestWithIdOnly = await prisma.clearanceRequest.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ClearanceRequestFindManyArgs>(args?: SelectSubset<T, ClearanceRequestFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClearanceRequestPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ClearanceRequest.
     * @param {ClearanceRequestCreateArgs} args - Arguments to create a ClearanceRequest.
     * @example
     * // Create one ClearanceRequest
     * const ClearanceRequest = await prisma.clearanceRequest.create({
     *   data: {
     *     // ... data to create a ClearanceRequest
     *   }
     * })
     * 
     */
    create<T extends ClearanceRequestCreateArgs>(args: SelectSubset<T, ClearanceRequestCreateArgs<ExtArgs>>): Prisma__ClearanceRequestClient<$Result.GetResult<Prisma.$ClearanceRequestPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ClearanceRequests.
     * @param {ClearanceRequestCreateManyArgs} args - Arguments to create many ClearanceRequests.
     * @example
     * // Create many ClearanceRequests
     * const clearanceRequest = await prisma.clearanceRequest.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ClearanceRequestCreateManyArgs>(args?: SelectSubset<T, ClearanceRequestCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ClearanceRequests and returns the data saved in the database.
     * @param {ClearanceRequestCreateManyAndReturnArgs} args - Arguments to create many ClearanceRequests.
     * @example
     * // Create many ClearanceRequests
     * const clearanceRequest = await prisma.clearanceRequest.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ClearanceRequests and only return the `id`
     * const clearanceRequestWithIdOnly = await prisma.clearanceRequest.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ClearanceRequestCreateManyAndReturnArgs>(args?: SelectSubset<T, ClearanceRequestCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClearanceRequestPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ClearanceRequest.
     * @param {ClearanceRequestDeleteArgs} args - Arguments to delete one ClearanceRequest.
     * @example
     * // Delete one ClearanceRequest
     * const ClearanceRequest = await prisma.clearanceRequest.delete({
     *   where: {
     *     // ... filter to delete one ClearanceRequest
     *   }
     * })
     * 
     */
    delete<T extends ClearanceRequestDeleteArgs>(args: SelectSubset<T, ClearanceRequestDeleteArgs<ExtArgs>>): Prisma__ClearanceRequestClient<$Result.GetResult<Prisma.$ClearanceRequestPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ClearanceRequest.
     * @param {ClearanceRequestUpdateArgs} args - Arguments to update one ClearanceRequest.
     * @example
     * // Update one ClearanceRequest
     * const clearanceRequest = await prisma.clearanceRequest.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ClearanceRequestUpdateArgs>(args: SelectSubset<T, ClearanceRequestUpdateArgs<ExtArgs>>): Prisma__ClearanceRequestClient<$Result.GetResult<Prisma.$ClearanceRequestPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ClearanceRequests.
     * @param {ClearanceRequestDeleteManyArgs} args - Arguments to filter ClearanceRequests to delete.
     * @example
     * // Delete a few ClearanceRequests
     * const { count } = await prisma.clearanceRequest.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ClearanceRequestDeleteManyArgs>(args?: SelectSubset<T, ClearanceRequestDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ClearanceRequests.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClearanceRequestUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ClearanceRequests
     * const clearanceRequest = await prisma.clearanceRequest.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ClearanceRequestUpdateManyArgs>(args: SelectSubset<T, ClearanceRequestUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ClearanceRequests and returns the data updated in the database.
     * @param {ClearanceRequestUpdateManyAndReturnArgs} args - Arguments to update many ClearanceRequests.
     * @example
     * // Update many ClearanceRequests
     * const clearanceRequest = await prisma.clearanceRequest.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ClearanceRequests and only return the `id`
     * const clearanceRequestWithIdOnly = await prisma.clearanceRequest.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ClearanceRequestUpdateManyAndReturnArgs>(args: SelectSubset<T, ClearanceRequestUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClearanceRequestPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ClearanceRequest.
     * @param {ClearanceRequestUpsertArgs} args - Arguments to update or create a ClearanceRequest.
     * @example
     * // Update or create a ClearanceRequest
     * const clearanceRequest = await prisma.clearanceRequest.upsert({
     *   create: {
     *     // ... data to create a ClearanceRequest
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ClearanceRequest we want to update
     *   }
     * })
     */
    upsert<T extends ClearanceRequestUpsertArgs>(args: SelectSubset<T, ClearanceRequestUpsertArgs<ExtArgs>>): Prisma__ClearanceRequestClient<$Result.GetResult<Prisma.$ClearanceRequestPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ClearanceRequests.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClearanceRequestCountArgs} args - Arguments to filter ClearanceRequests to count.
     * @example
     * // Count the number of ClearanceRequests
     * const count = await prisma.clearanceRequest.count({
     *   where: {
     *     // ... the filter for the ClearanceRequests we want to count
     *   }
     * })
    **/
    count<T extends ClearanceRequestCountArgs>(
      args?: Subset<T, ClearanceRequestCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ClearanceRequestCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ClearanceRequest.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClearanceRequestAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ClearanceRequestAggregateArgs>(args: Subset<T, ClearanceRequestAggregateArgs>): Prisma.PrismaPromise<GetClearanceRequestAggregateType<T>>

    /**
     * Group by ClearanceRequest.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClearanceRequestGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ClearanceRequestGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ClearanceRequestGroupByArgs['orderBy'] }
        : { orderBy?: ClearanceRequestGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ClearanceRequestGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetClearanceRequestGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ClearanceRequest model
   */
  readonly fields: ClearanceRequestFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ClearanceRequest.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ClearanceRequestClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    organization<T extends OrganizationDefaultArgs<ExtArgs> = {}>(args?: Subset<T, OrganizationDefaultArgs<ExtArgs>>): Prisma__OrganizationClient<$Result.GetResult<Prisma.$OrganizationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    student<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    steps<T extends ClearanceRequest$stepsArgs<ExtArgs> = {}>(args?: Subset<T, ClearanceRequest$stepsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClearanceStepPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    transactions<T extends ClearanceRequest$transactionsArgs<ExtArgs> = {}>(args?: Subset<T, ClearanceRequest$transactionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ClearanceRequest model
   */
  interface ClearanceRequestFieldRefs {
    readonly id: FieldRef<"ClearanceRequest", 'String'>
    readonly academicYear: FieldRef<"ClearanceRequest", 'String'>
    readonly semester: FieldRef<"ClearanceRequest", 'String'>
    readonly status: FieldRef<"ClearanceRequest", 'RequestStatus'>
    readonly qrPayload: FieldRef<"ClearanceRequest", 'String'>
    readonly organizationId: FieldRef<"ClearanceRequest", 'String'>
    readonly studentId: FieldRef<"ClearanceRequest", 'String'>
    readonly createdAt: FieldRef<"ClearanceRequest", 'DateTime'>
    readonly updatedAt: FieldRef<"ClearanceRequest", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ClearanceRequest findUnique
   */
  export type ClearanceRequestFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceRequest
     */
    select?: ClearanceRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceRequest
     */
    omit?: ClearanceRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceRequestInclude<ExtArgs> | null
    /**
     * Filter, which ClearanceRequest to fetch.
     */
    where: ClearanceRequestWhereUniqueInput
  }

  /**
   * ClearanceRequest findUniqueOrThrow
   */
  export type ClearanceRequestFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceRequest
     */
    select?: ClearanceRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceRequest
     */
    omit?: ClearanceRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceRequestInclude<ExtArgs> | null
    /**
     * Filter, which ClearanceRequest to fetch.
     */
    where: ClearanceRequestWhereUniqueInput
  }

  /**
   * ClearanceRequest findFirst
   */
  export type ClearanceRequestFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceRequest
     */
    select?: ClearanceRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceRequest
     */
    omit?: ClearanceRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceRequestInclude<ExtArgs> | null
    /**
     * Filter, which ClearanceRequest to fetch.
     */
    where?: ClearanceRequestWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClearanceRequests to fetch.
     */
    orderBy?: ClearanceRequestOrderByWithRelationInput | ClearanceRequestOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ClearanceRequests.
     */
    cursor?: ClearanceRequestWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClearanceRequests from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClearanceRequests.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ClearanceRequests.
     */
    distinct?: ClearanceRequestScalarFieldEnum | ClearanceRequestScalarFieldEnum[]
  }

  /**
   * ClearanceRequest findFirstOrThrow
   */
  export type ClearanceRequestFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceRequest
     */
    select?: ClearanceRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceRequest
     */
    omit?: ClearanceRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceRequestInclude<ExtArgs> | null
    /**
     * Filter, which ClearanceRequest to fetch.
     */
    where?: ClearanceRequestWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClearanceRequests to fetch.
     */
    orderBy?: ClearanceRequestOrderByWithRelationInput | ClearanceRequestOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ClearanceRequests.
     */
    cursor?: ClearanceRequestWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClearanceRequests from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClearanceRequests.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ClearanceRequests.
     */
    distinct?: ClearanceRequestScalarFieldEnum | ClearanceRequestScalarFieldEnum[]
  }

  /**
   * ClearanceRequest findMany
   */
  export type ClearanceRequestFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceRequest
     */
    select?: ClearanceRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceRequest
     */
    omit?: ClearanceRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceRequestInclude<ExtArgs> | null
    /**
     * Filter, which ClearanceRequests to fetch.
     */
    where?: ClearanceRequestWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClearanceRequests to fetch.
     */
    orderBy?: ClearanceRequestOrderByWithRelationInput | ClearanceRequestOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ClearanceRequests.
     */
    cursor?: ClearanceRequestWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClearanceRequests from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClearanceRequests.
     */
    skip?: number
    distinct?: ClearanceRequestScalarFieldEnum | ClearanceRequestScalarFieldEnum[]
  }

  /**
   * ClearanceRequest create
   */
  export type ClearanceRequestCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceRequest
     */
    select?: ClearanceRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceRequest
     */
    omit?: ClearanceRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceRequestInclude<ExtArgs> | null
    /**
     * The data needed to create a ClearanceRequest.
     */
    data: XOR<ClearanceRequestCreateInput, ClearanceRequestUncheckedCreateInput>
  }

  /**
   * ClearanceRequest createMany
   */
  export type ClearanceRequestCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ClearanceRequests.
     */
    data: ClearanceRequestCreateManyInput | ClearanceRequestCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ClearanceRequest createManyAndReturn
   */
  export type ClearanceRequestCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceRequest
     */
    select?: ClearanceRequestSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceRequest
     */
    omit?: ClearanceRequestOmit<ExtArgs> | null
    /**
     * The data used to create many ClearanceRequests.
     */
    data: ClearanceRequestCreateManyInput | ClearanceRequestCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceRequestIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ClearanceRequest update
   */
  export type ClearanceRequestUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceRequest
     */
    select?: ClearanceRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceRequest
     */
    omit?: ClearanceRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceRequestInclude<ExtArgs> | null
    /**
     * The data needed to update a ClearanceRequest.
     */
    data: XOR<ClearanceRequestUpdateInput, ClearanceRequestUncheckedUpdateInput>
    /**
     * Choose, which ClearanceRequest to update.
     */
    where: ClearanceRequestWhereUniqueInput
  }

  /**
   * ClearanceRequest updateMany
   */
  export type ClearanceRequestUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ClearanceRequests.
     */
    data: XOR<ClearanceRequestUpdateManyMutationInput, ClearanceRequestUncheckedUpdateManyInput>
    /**
     * Filter which ClearanceRequests to update
     */
    where?: ClearanceRequestWhereInput
    /**
     * Limit how many ClearanceRequests to update.
     */
    limit?: number
  }

  /**
   * ClearanceRequest updateManyAndReturn
   */
  export type ClearanceRequestUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceRequest
     */
    select?: ClearanceRequestSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceRequest
     */
    omit?: ClearanceRequestOmit<ExtArgs> | null
    /**
     * The data used to update ClearanceRequests.
     */
    data: XOR<ClearanceRequestUpdateManyMutationInput, ClearanceRequestUncheckedUpdateManyInput>
    /**
     * Filter which ClearanceRequests to update
     */
    where?: ClearanceRequestWhereInput
    /**
     * Limit how many ClearanceRequests to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceRequestIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * ClearanceRequest upsert
   */
  export type ClearanceRequestUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceRequest
     */
    select?: ClearanceRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceRequest
     */
    omit?: ClearanceRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceRequestInclude<ExtArgs> | null
    /**
     * The filter to search for the ClearanceRequest to update in case it exists.
     */
    where: ClearanceRequestWhereUniqueInput
    /**
     * In case the ClearanceRequest found by the `where` argument doesn't exist, create a new ClearanceRequest with this data.
     */
    create: XOR<ClearanceRequestCreateInput, ClearanceRequestUncheckedCreateInput>
    /**
     * In case the ClearanceRequest was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ClearanceRequestUpdateInput, ClearanceRequestUncheckedUpdateInput>
  }

  /**
   * ClearanceRequest delete
   */
  export type ClearanceRequestDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceRequest
     */
    select?: ClearanceRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceRequest
     */
    omit?: ClearanceRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceRequestInclude<ExtArgs> | null
    /**
     * Filter which ClearanceRequest to delete.
     */
    where: ClearanceRequestWhereUniqueInput
  }

  /**
   * ClearanceRequest deleteMany
   */
  export type ClearanceRequestDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ClearanceRequests to delete
     */
    where?: ClearanceRequestWhereInput
    /**
     * Limit how many ClearanceRequests to delete.
     */
    limit?: number
  }

  /**
   * ClearanceRequest.steps
   */
  export type ClearanceRequest$stepsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceStep
     */
    select?: ClearanceStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceStep
     */
    omit?: ClearanceStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceStepInclude<ExtArgs> | null
    where?: ClearanceStepWhereInput
    orderBy?: ClearanceStepOrderByWithRelationInput | ClearanceStepOrderByWithRelationInput[]
    cursor?: ClearanceStepWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ClearanceStepScalarFieldEnum | ClearanceStepScalarFieldEnum[]
  }

  /**
   * ClearanceRequest.transactions
   */
  export type ClearanceRequest$transactionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    where?: TransactionWhereInput
    orderBy?: TransactionOrderByWithRelationInput | TransactionOrderByWithRelationInput[]
    cursor?: TransactionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TransactionScalarFieldEnum | TransactionScalarFieldEnum[]
  }

  /**
   * ClearanceRequest without action
   */
  export type ClearanceRequestDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceRequest
     */
    select?: ClearanceRequestSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceRequest
     */
    omit?: ClearanceRequestOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceRequestInclude<ExtArgs> | null
  }


  /**
   * Model ClearanceStep
   */

  export type AggregateClearanceStep = {
    _count: ClearanceStepCountAggregateOutputType | null
    _min: ClearanceStepMinAggregateOutputType | null
    _max: ClearanceStepMaxAggregateOutputType | null
  }

  export type ClearanceStepMinAggregateOutputType = {
    id: string | null
    nodeName: string | null
    status: $Enums.StepStatus | null
    remarks: string | null
    requestId: string | null
    clearedById: string | null
    updatedAt: Date | null
  }

  export type ClearanceStepMaxAggregateOutputType = {
    id: string | null
    nodeName: string | null
    status: $Enums.StepStatus | null
    remarks: string | null
    requestId: string | null
    clearedById: string | null
    updatedAt: Date | null
  }

  export type ClearanceStepCountAggregateOutputType = {
    id: number
    nodeName: number
    status: number
    remarks: number
    requestId: number
    clearedById: number
    updatedAt: number
    _all: number
  }


  export type ClearanceStepMinAggregateInputType = {
    id?: true
    nodeName?: true
    status?: true
    remarks?: true
    requestId?: true
    clearedById?: true
    updatedAt?: true
  }

  export type ClearanceStepMaxAggregateInputType = {
    id?: true
    nodeName?: true
    status?: true
    remarks?: true
    requestId?: true
    clearedById?: true
    updatedAt?: true
  }

  export type ClearanceStepCountAggregateInputType = {
    id?: true
    nodeName?: true
    status?: true
    remarks?: true
    requestId?: true
    clearedById?: true
    updatedAt?: true
    _all?: true
  }

  export type ClearanceStepAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ClearanceStep to aggregate.
     */
    where?: ClearanceStepWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClearanceSteps to fetch.
     */
    orderBy?: ClearanceStepOrderByWithRelationInput | ClearanceStepOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ClearanceStepWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClearanceSteps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClearanceSteps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ClearanceSteps
    **/
    _count?: true | ClearanceStepCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ClearanceStepMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ClearanceStepMaxAggregateInputType
  }

  export type GetClearanceStepAggregateType<T extends ClearanceStepAggregateArgs> = {
        [P in keyof T & keyof AggregateClearanceStep]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateClearanceStep[P]>
      : GetScalarType<T[P], AggregateClearanceStep[P]>
  }




  export type ClearanceStepGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClearanceStepWhereInput
    orderBy?: ClearanceStepOrderByWithAggregationInput | ClearanceStepOrderByWithAggregationInput[]
    by: ClearanceStepScalarFieldEnum[] | ClearanceStepScalarFieldEnum
    having?: ClearanceStepScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ClearanceStepCountAggregateInputType | true
    _min?: ClearanceStepMinAggregateInputType
    _max?: ClearanceStepMaxAggregateInputType
  }

  export type ClearanceStepGroupByOutputType = {
    id: string
    nodeName: string
    status: $Enums.StepStatus
    remarks: string | null
    requestId: string
    clearedById: string | null
    updatedAt: Date
    _count: ClearanceStepCountAggregateOutputType | null
    _min: ClearanceStepMinAggregateOutputType | null
    _max: ClearanceStepMaxAggregateOutputType | null
  }

  type GetClearanceStepGroupByPayload<T extends ClearanceStepGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ClearanceStepGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ClearanceStepGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ClearanceStepGroupByOutputType[P]>
            : GetScalarType<T[P], ClearanceStepGroupByOutputType[P]>
        }
      >
    >


  export type ClearanceStepSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    nodeName?: boolean
    status?: boolean
    remarks?: boolean
    requestId?: boolean
    clearedById?: boolean
    updatedAt?: boolean
    request?: boolean | ClearanceRequestDefaultArgs<ExtArgs>
    clearedBy?: boolean | ClearanceStep$clearedByArgs<ExtArgs>
  }, ExtArgs["result"]["clearanceStep"]>

  export type ClearanceStepSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    nodeName?: boolean
    status?: boolean
    remarks?: boolean
    requestId?: boolean
    clearedById?: boolean
    updatedAt?: boolean
    request?: boolean | ClearanceRequestDefaultArgs<ExtArgs>
    clearedBy?: boolean | ClearanceStep$clearedByArgs<ExtArgs>
  }, ExtArgs["result"]["clearanceStep"]>

  export type ClearanceStepSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    nodeName?: boolean
    status?: boolean
    remarks?: boolean
    requestId?: boolean
    clearedById?: boolean
    updatedAt?: boolean
    request?: boolean | ClearanceRequestDefaultArgs<ExtArgs>
    clearedBy?: boolean | ClearanceStep$clearedByArgs<ExtArgs>
  }, ExtArgs["result"]["clearanceStep"]>

  export type ClearanceStepSelectScalar = {
    id?: boolean
    nodeName?: boolean
    status?: boolean
    remarks?: boolean
    requestId?: boolean
    clearedById?: boolean
    updatedAt?: boolean
  }

  export type ClearanceStepOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "nodeName" | "status" | "remarks" | "requestId" | "clearedById" | "updatedAt", ExtArgs["result"]["clearanceStep"]>
  export type ClearanceStepInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    request?: boolean | ClearanceRequestDefaultArgs<ExtArgs>
    clearedBy?: boolean | ClearanceStep$clearedByArgs<ExtArgs>
  }
  export type ClearanceStepIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    request?: boolean | ClearanceRequestDefaultArgs<ExtArgs>
    clearedBy?: boolean | ClearanceStep$clearedByArgs<ExtArgs>
  }
  export type ClearanceStepIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    request?: boolean | ClearanceRequestDefaultArgs<ExtArgs>
    clearedBy?: boolean | ClearanceStep$clearedByArgs<ExtArgs>
  }

  export type $ClearanceStepPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ClearanceStep"
    objects: {
      request: Prisma.$ClearanceRequestPayload<ExtArgs>
      clearedBy: Prisma.$UserPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      nodeName: string
      status: $Enums.StepStatus
      remarks: string | null
      requestId: string
      clearedById: string | null
      updatedAt: Date
    }, ExtArgs["result"]["clearanceStep"]>
    composites: {}
  }

  type ClearanceStepGetPayload<S extends boolean | null | undefined | ClearanceStepDefaultArgs> = $Result.GetResult<Prisma.$ClearanceStepPayload, S>

  type ClearanceStepCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ClearanceStepFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ClearanceStepCountAggregateInputType | true
    }

  export interface ClearanceStepDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ClearanceStep'], meta: { name: 'ClearanceStep' } }
    /**
     * Find zero or one ClearanceStep that matches the filter.
     * @param {ClearanceStepFindUniqueArgs} args - Arguments to find a ClearanceStep
     * @example
     * // Get one ClearanceStep
     * const clearanceStep = await prisma.clearanceStep.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ClearanceStepFindUniqueArgs>(args: SelectSubset<T, ClearanceStepFindUniqueArgs<ExtArgs>>): Prisma__ClearanceStepClient<$Result.GetResult<Prisma.$ClearanceStepPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ClearanceStep that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ClearanceStepFindUniqueOrThrowArgs} args - Arguments to find a ClearanceStep
     * @example
     * // Get one ClearanceStep
     * const clearanceStep = await prisma.clearanceStep.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ClearanceStepFindUniqueOrThrowArgs>(args: SelectSubset<T, ClearanceStepFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ClearanceStepClient<$Result.GetResult<Prisma.$ClearanceStepPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ClearanceStep that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClearanceStepFindFirstArgs} args - Arguments to find a ClearanceStep
     * @example
     * // Get one ClearanceStep
     * const clearanceStep = await prisma.clearanceStep.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ClearanceStepFindFirstArgs>(args?: SelectSubset<T, ClearanceStepFindFirstArgs<ExtArgs>>): Prisma__ClearanceStepClient<$Result.GetResult<Prisma.$ClearanceStepPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ClearanceStep that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClearanceStepFindFirstOrThrowArgs} args - Arguments to find a ClearanceStep
     * @example
     * // Get one ClearanceStep
     * const clearanceStep = await prisma.clearanceStep.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ClearanceStepFindFirstOrThrowArgs>(args?: SelectSubset<T, ClearanceStepFindFirstOrThrowArgs<ExtArgs>>): Prisma__ClearanceStepClient<$Result.GetResult<Prisma.$ClearanceStepPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ClearanceSteps that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClearanceStepFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ClearanceSteps
     * const clearanceSteps = await prisma.clearanceStep.findMany()
     * 
     * // Get first 10 ClearanceSteps
     * const clearanceSteps = await prisma.clearanceStep.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const clearanceStepWithIdOnly = await prisma.clearanceStep.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ClearanceStepFindManyArgs>(args?: SelectSubset<T, ClearanceStepFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClearanceStepPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ClearanceStep.
     * @param {ClearanceStepCreateArgs} args - Arguments to create a ClearanceStep.
     * @example
     * // Create one ClearanceStep
     * const ClearanceStep = await prisma.clearanceStep.create({
     *   data: {
     *     // ... data to create a ClearanceStep
     *   }
     * })
     * 
     */
    create<T extends ClearanceStepCreateArgs>(args: SelectSubset<T, ClearanceStepCreateArgs<ExtArgs>>): Prisma__ClearanceStepClient<$Result.GetResult<Prisma.$ClearanceStepPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ClearanceSteps.
     * @param {ClearanceStepCreateManyArgs} args - Arguments to create many ClearanceSteps.
     * @example
     * // Create many ClearanceSteps
     * const clearanceStep = await prisma.clearanceStep.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ClearanceStepCreateManyArgs>(args?: SelectSubset<T, ClearanceStepCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ClearanceSteps and returns the data saved in the database.
     * @param {ClearanceStepCreateManyAndReturnArgs} args - Arguments to create many ClearanceSteps.
     * @example
     * // Create many ClearanceSteps
     * const clearanceStep = await prisma.clearanceStep.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ClearanceSteps and only return the `id`
     * const clearanceStepWithIdOnly = await prisma.clearanceStep.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ClearanceStepCreateManyAndReturnArgs>(args?: SelectSubset<T, ClearanceStepCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClearanceStepPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ClearanceStep.
     * @param {ClearanceStepDeleteArgs} args - Arguments to delete one ClearanceStep.
     * @example
     * // Delete one ClearanceStep
     * const ClearanceStep = await prisma.clearanceStep.delete({
     *   where: {
     *     // ... filter to delete one ClearanceStep
     *   }
     * })
     * 
     */
    delete<T extends ClearanceStepDeleteArgs>(args: SelectSubset<T, ClearanceStepDeleteArgs<ExtArgs>>): Prisma__ClearanceStepClient<$Result.GetResult<Prisma.$ClearanceStepPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ClearanceStep.
     * @param {ClearanceStepUpdateArgs} args - Arguments to update one ClearanceStep.
     * @example
     * // Update one ClearanceStep
     * const clearanceStep = await prisma.clearanceStep.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ClearanceStepUpdateArgs>(args: SelectSubset<T, ClearanceStepUpdateArgs<ExtArgs>>): Prisma__ClearanceStepClient<$Result.GetResult<Prisma.$ClearanceStepPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ClearanceSteps.
     * @param {ClearanceStepDeleteManyArgs} args - Arguments to filter ClearanceSteps to delete.
     * @example
     * // Delete a few ClearanceSteps
     * const { count } = await prisma.clearanceStep.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ClearanceStepDeleteManyArgs>(args?: SelectSubset<T, ClearanceStepDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ClearanceSteps.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClearanceStepUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ClearanceSteps
     * const clearanceStep = await prisma.clearanceStep.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ClearanceStepUpdateManyArgs>(args: SelectSubset<T, ClearanceStepUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ClearanceSteps and returns the data updated in the database.
     * @param {ClearanceStepUpdateManyAndReturnArgs} args - Arguments to update many ClearanceSteps.
     * @example
     * // Update many ClearanceSteps
     * const clearanceStep = await prisma.clearanceStep.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ClearanceSteps and only return the `id`
     * const clearanceStepWithIdOnly = await prisma.clearanceStep.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ClearanceStepUpdateManyAndReturnArgs>(args: SelectSubset<T, ClearanceStepUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClearanceStepPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ClearanceStep.
     * @param {ClearanceStepUpsertArgs} args - Arguments to update or create a ClearanceStep.
     * @example
     * // Update or create a ClearanceStep
     * const clearanceStep = await prisma.clearanceStep.upsert({
     *   create: {
     *     // ... data to create a ClearanceStep
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ClearanceStep we want to update
     *   }
     * })
     */
    upsert<T extends ClearanceStepUpsertArgs>(args: SelectSubset<T, ClearanceStepUpsertArgs<ExtArgs>>): Prisma__ClearanceStepClient<$Result.GetResult<Prisma.$ClearanceStepPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ClearanceSteps.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClearanceStepCountArgs} args - Arguments to filter ClearanceSteps to count.
     * @example
     * // Count the number of ClearanceSteps
     * const count = await prisma.clearanceStep.count({
     *   where: {
     *     // ... the filter for the ClearanceSteps we want to count
     *   }
     * })
    **/
    count<T extends ClearanceStepCountArgs>(
      args?: Subset<T, ClearanceStepCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ClearanceStepCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ClearanceStep.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClearanceStepAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ClearanceStepAggregateArgs>(args: Subset<T, ClearanceStepAggregateArgs>): Prisma.PrismaPromise<GetClearanceStepAggregateType<T>>

    /**
     * Group by ClearanceStep.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClearanceStepGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ClearanceStepGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ClearanceStepGroupByArgs['orderBy'] }
        : { orderBy?: ClearanceStepGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ClearanceStepGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetClearanceStepGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ClearanceStep model
   */
  readonly fields: ClearanceStepFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ClearanceStep.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ClearanceStepClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    request<T extends ClearanceRequestDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ClearanceRequestDefaultArgs<ExtArgs>>): Prisma__ClearanceRequestClient<$Result.GetResult<Prisma.$ClearanceRequestPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    clearedBy<T extends ClearanceStep$clearedByArgs<ExtArgs> = {}>(args?: Subset<T, ClearanceStep$clearedByArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ClearanceStep model
   */
  interface ClearanceStepFieldRefs {
    readonly id: FieldRef<"ClearanceStep", 'String'>
    readonly nodeName: FieldRef<"ClearanceStep", 'String'>
    readonly status: FieldRef<"ClearanceStep", 'StepStatus'>
    readonly remarks: FieldRef<"ClearanceStep", 'String'>
    readonly requestId: FieldRef<"ClearanceStep", 'String'>
    readonly clearedById: FieldRef<"ClearanceStep", 'String'>
    readonly updatedAt: FieldRef<"ClearanceStep", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ClearanceStep findUnique
   */
  export type ClearanceStepFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceStep
     */
    select?: ClearanceStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceStep
     */
    omit?: ClearanceStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceStepInclude<ExtArgs> | null
    /**
     * Filter, which ClearanceStep to fetch.
     */
    where: ClearanceStepWhereUniqueInput
  }

  /**
   * ClearanceStep findUniqueOrThrow
   */
  export type ClearanceStepFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceStep
     */
    select?: ClearanceStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceStep
     */
    omit?: ClearanceStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceStepInclude<ExtArgs> | null
    /**
     * Filter, which ClearanceStep to fetch.
     */
    where: ClearanceStepWhereUniqueInput
  }

  /**
   * ClearanceStep findFirst
   */
  export type ClearanceStepFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceStep
     */
    select?: ClearanceStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceStep
     */
    omit?: ClearanceStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceStepInclude<ExtArgs> | null
    /**
     * Filter, which ClearanceStep to fetch.
     */
    where?: ClearanceStepWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClearanceSteps to fetch.
     */
    orderBy?: ClearanceStepOrderByWithRelationInput | ClearanceStepOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ClearanceSteps.
     */
    cursor?: ClearanceStepWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClearanceSteps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClearanceSteps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ClearanceSteps.
     */
    distinct?: ClearanceStepScalarFieldEnum | ClearanceStepScalarFieldEnum[]
  }

  /**
   * ClearanceStep findFirstOrThrow
   */
  export type ClearanceStepFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceStep
     */
    select?: ClearanceStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceStep
     */
    omit?: ClearanceStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceStepInclude<ExtArgs> | null
    /**
     * Filter, which ClearanceStep to fetch.
     */
    where?: ClearanceStepWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClearanceSteps to fetch.
     */
    orderBy?: ClearanceStepOrderByWithRelationInput | ClearanceStepOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ClearanceSteps.
     */
    cursor?: ClearanceStepWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClearanceSteps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClearanceSteps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ClearanceSteps.
     */
    distinct?: ClearanceStepScalarFieldEnum | ClearanceStepScalarFieldEnum[]
  }

  /**
   * ClearanceStep findMany
   */
  export type ClearanceStepFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceStep
     */
    select?: ClearanceStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceStep
     */
    omit?: ClearanceStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceStepInclude<ExtArgs> | null
    /**
     * Filter, which ClearanceSteps to fetch.
     */
    where?: ClearanceStepWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClearanceSteps to fetch.
     */
    orderBy?: ClearanceStepOrderByWithRelationInput | ClearanceStepOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ClearanceSteps.
     */
    cursor?: ClearanceStepWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClearanceSteps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClearanceSteps.
     */
    skip?: number
    distinct?: ClearanceStepScalarFieldEnum | ClearanceStepScalarFieldEnum[]
  }

  /**
   * ClearanceStep create
   */
  export type ClearanceStepCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceStep
     */
    select?: ClearanceStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceStep
     */
    omit?: ClearanceStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceStepInclude<ExtArgs> | null
    /**
     * The data needed to create a ClearanceStep.
     */
    data: XOR<ClearanceStepCreateInput, ClearanceStepUncheckedCreateInput>
  }

  /**
   * ClearanceStep createMany
   */
  export type ClearanceStepCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ClearanceSteps.
     */
    data: ClearanceStepCreateManyInput | ClearanceStepCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ClearanceStep createManyAndReturn
   */
  export type ClearanceStepCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceStep
     */
    select?: ClearanceStepSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceStep
     */
    omit?: ClearanceStepOmit<ExtArgs> | null
    /**
     * The data used to create many ClearanceSteps.
     */
    data: ClearanceStepCreateManyInput | ClearanceStepCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceStepIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ClearanceStep update
   */
  export type ClearanceStepUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceStep
     */
    select?: ClearanceStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceStep
     */
    omit?: ClearanceStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceStepInclude<ExtArgs> | null
    /**
     * The data needed to update a ClearanceStep.
     */
    data: XOR<ClearanceStepUpdateInput, ClearanceStepUncheckedUpdateInput>
    /**
     * Choose, which ClearanceStep to update.
     */
    where: ClearanceStepWhereUniqueInput
  }

  /**
   * ClearanceStep updateMany
   */
  export type ClearanceStepUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ClearanceSteps.
     */
    data: XOR<ClearanceStepUpdateManyMutationInput, ClearanceStepUncheckedUpdateManyInput>
    /**
     * Filter which ClearanceSteps to update
     */
    where?: ClearanceStepWhereInput
    /**
     * Limit how many ClearanceSteps to update.
     */
    limit?: number
  }

  /**
   * ClearanceStep updateManyAndReturn
   */
  export type ClearanceStepUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceStep
     */
    select?: ClearanceStepSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceStep
     */
    omit?: ClearanceStepOmit<ExtArgs> | null
    /**
     * The data used to update ClearanceSteps.
     */
    data: XOR<ClearanceStepUpdateManyMutationInput, ClearanceStepUncheckedUpdateManyInput>
    /**
     * Filter which ClearanceSteps to update
     */
    where?: ClearanceStepWhereInput
    /**
     * Limit how many ClearanceSteps to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceStepIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * ClearanceStep upsert
   */
  export type ClearanceStepUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceStep
     */
    select?: ClearanceStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceStep
     */
    omit?: ClearanceStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceStepInclude<ExtArgs> | null
    /**
     * The filter to search for the ClearanceStep to update in case it exists.
     */
    where: ClearanceStepWhereUniqueInput
    /**
     * In case the ClearanceStep found by the `where` argument doesn't exist, create a new ClearanceStep with this data.
     */
    create: XOR<ClearanceStepCreateInput, ClearanceStepUncheckedCreateInput>
    /**
     * In case the ClearanceStep was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ClearanceStepUpdateInput, ClearanceStepUncheckedUpdateInput>
  }

  /**
   * ClearanceStep delete
   */
  export type ClearanceStepDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceStep
     */
    select?: ClearanceStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceStep
     */
    omit?: ClearanceStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceStepInclude<ExtArgs> | null
    /**
     * Filter which ClearanceStep to delete.
     */
    where: ClearanceStepWhereUniqueInput
  }

  /**
   * ClearanceStep deleteMany
   */
  export type ClearanceStepDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ClearanceSteps to delete
     */
    where?: ClearanceStepWhereInput
    /**
     * Limit how many ClearanceSteps to delete.
     */
    limit?: number
  }

  /**
   * ClearanceStep.clearedBy
   */
  export type ClearanceStep$clearedByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    where?: UserWhereInput
  }

  /**
   * ClearanceStep without action
   */
  export type ClearanceStepDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClearanceStep
     */
    select?: ClearanceStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClearanceStep
     */
    omit?: ClearanceStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClearanceStepInclude<ExtArgs> | null
  }


  /**
   * Model Transaction
   */

  export type AggregateTransaction = {
    _count: TransactionCountAggregateOutputType | null
    _avg: TransactionAvgAggregateOutputType | null
    _sum: TransactionSumAggregateOutputType | null
    _min: TransactionMinAggregateOutputType | null
    _max: TransactionMaxAggregateOutputType | null
  }

  export type TransactionAvgAggregateOutputType = {
    amount: Decimal | null
  }

  export type TransactionSumAggregateOutputType = {
    amount: Decimal | null
  }

  export type TransactionMinAggregateOutputType = {
    id: string | null
    amount: Decimal | null
    referenceNo: string | null
    proofUrl: string | null
    verified: boolean | null
    requestId: string | null
    createdAt: Date | null
  }

  export type TransactionMaxAggregateOutputType = {
    id: string | null
    amount: Decimal | null
    referenceNo: string | null
    proofUrl: string | null
    verified: boolean | null
    requestId: string | null
    createdAt: Date | null
  }

  export type TransactionCountAggregateOutputType = {
    id: number
    amount: number
    referenceNo: number
    proofUrl: number
    verified: number
    requestId: number
    createdAt: number
    _all: number
  }


  export type TransactionAvgAggregateInputType = {
    amount?: true
  }

  export type TransactionSumAggregateInputType = {
    amount?: true
  }

  export type TransactionMinAggregateInputType = {
    id?: true
    amount?: true
    referenceNo?: true
    proofUrl?: true
    verified?: true
    requestId?: true
    createdAt?: true
  }

  export type TransactionMaxAggregateInputType = {
    id?: true
    amount?: true
    referenceNo?: true
    proofUrl?: true
    verified?: true
    requestId?: true
    createdAt?: true
  }

  export type TransactionCountAggregateInputType = {
    id?: true
    amount?: true
    referenceNo?: true
    proofUrl?: true
    verified?: true
    requestId?: true
    createdAt?: true
    _all?: true
  }

  export type TransactionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Transaction to aggregate.
     */
    where?: TransactionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Transactions to fetch.
     */
    orderBy?: TransactionOrderByWithRelationInput | TransactionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TransactionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Transactions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Transactions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Transactions
    **/
    _count?: true | TransactionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TransactionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TransactionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TransactionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TransactionMaxAggregateInputType
  }

  export type GetTransactionAggregateType<T extends TransactionAggregateArgs> = {
        [P in keyof T & keyof AggregateTransaction]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTransaction[P]>
      : GetScalarType<T[P], AggregateTransaction[P]>
  }




  export type TransactionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TransactionWhereInput
    orderBy?: TransactionOrderByWithAggregationInput | TransactionOrderByWithAggregationInput[]
    by: TransactionScalarFieldEnum[] | TransactionScalarFieldEnum
    having?: TransactionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TransactionCountAggregateInputType | true
    _avg?: TransactionAvgAggregateInputType
    _sum?: TransactionSumAggregateInputType
    _min?: TransactionMinAggregateInputType
    _max?: TransactionMaxAggregateInputType
  }

  export type TransactionGroupByOutputType = {
    id: string
    amount: Decimal
    referenceNo: string
    proofUrl: string | null
    verified: boolean
    requestId: string
    createdAt: Date
    _count: TransactionCountAggregateOutputType | null
    _avg: TransactionAvgAggregateOutputType | null
    _sum: TransactionSumAggregateOutputType | null
    _min: TransactionMinAggregateOutputType | null
    _max: TransactionMaxAggregateOutputType | null
  }

  type GetTransactionGroupByPayload<T extends TransactionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TransactionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TransactionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TransactionGroupByOutputType[P]>
            : GetScalarType<T[P], TransactionGroupByOutputType[P]>
        }
      >
    >


  export type TransactionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    amount?: boolean
    referenceNo?: boolean
    proofUrl?: boolean
    verified?: boolean
    requestId?: boolean
    createdAt?: boolean
    request?: boolean | ClearanceRequestDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["transaction"]>

  export type TransactionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    amount?: boolean
    referenceNo?: boolean
    proofUrl?: boolean
    verified?: boolean
    requestId?: boolean
    createdAt?: boolean
    request?: boolean | ClearanceRequestDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["transaction"]>

  export type TransactionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    amount?: boolean
    referenceNo?: boolean
    proofUrl?: boolean
    verified?: boolean
    requestId?: boolean
    createdAt?: boolean
    request?: boolean | ClearanceRequestDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["transaction"]>

  export type TransactionSelectScalar = {
    id?: boolean
    amount?: boolean
    referenceNo?: boolean
    proofUrl?: boolean
    verified?: boolean
    requestId?: boolean
    createdAt?: boolean
  }

  export type TransactionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "amount" | "referenceNo" | "proofUrl" | "verified" | "requestId" | "createdAt", ExtArgs["result"]["transaction"]>
  export type TransactionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    request?: boolean | ClearanceRequestDefaultArgs<ExtArgs>
  }
  export type TransactionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    request?: boolean | ClearanceRequestDefaultArgs<ExtArgs>
  }
  export type TransactionIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    request?: boolean | ClearanceRequestDefaultArgs<ExtArgs>
  }

  export type $TransactionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Transaction"
    objects: {
      request: Prisma.$ClearanceRequestPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      amount: Prisma.Decimal
      referenceNo: string
      proofUrl: string | null
      verified: boolean
      requestId: string
      createdAt: Date
    }, ExtArgs["result"]["transaction"]>
    composites: {}
  }

  type TransactionGetPayload<S extends boolean | null | undefined | TransactionDefaultArgs> = $Result.GetResult<Prisma.$TransactionPayload, S>

  type TransactionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TransactionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TransactionCountAggregateInputType | true
    }

  export interface TransactionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Transaction'], meta: { name: 'Transaction' } }
    /**
     * Find zero or one Transaction that matches the filter.
     * @param {TransactionFindUniqueArgs} args - Arguments to find a Transaction
     * @example
     * // Get one Transaction
     * const transaction = await prisma.transaction.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TransactionFindUniqueArgs>(args: SelectSubset<T, TransactionFindUniqueArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Transaction that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TransactionFindUniqueOrThrowArgs} args - Arguments to find a Transaction
     * @example
     * // Get one Transaction
     * const transaction = await prisma.transaction.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TransactionFindUniqueOrThrowArgs>(args: SelectSubset<T, TransactionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Transaction that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionFindFirstArgs} args - Arguments to find a Transaction
     * @example
     * // Get one Transaction
     * const transaction = await prisma.transaction.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TransactionFindFirstArgs>(args?: SelectSubset<T, TransactionFindFirstArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Transaction that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionFindFirstOrThrowArgs} args - Arguments to find a Transaction
     * @example
     * // Get one Transaction
     * const transaction = await prisma.transaction.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TransactionFindFirstOrThrowArgs>(args?: SelectSubset<T, TransactionFindFirstOrThrowArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Transactions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Transactions
     * const transactions = await prisma.transaction.findMany()
     * 
     * // Get first 10 Transactions
     * const transactions = await prisma.transaction.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const transactionWithIdOnly = await prisma.transaction.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TransactionFindManyArgs>(args?: SelectSubset<T, TransactionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Transaction.
     * @param {TransactionCreateArgs} args - Arguments to create a Transaction.
     * @example
     * // Create one Transaction
     * const Transaction = await prisma.transaction.create({
     *   data: {
     *     // ... data to create a Transaction
     *   }
     * })
     * 
     */
    create<T extends TransactionCreateArgs>(args: SelectSubset<T, TransactionCreateArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Transactions.
     * @param {TransactionCreateManyArgs} args - Arguments to create many Transactions.
     * @example
     * // Create many Transactions
     * const transaction = await prisma.transaction.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TransactionCreateManyArgs>(args?: SelectSubset<T, TransactionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Transactions and returns the data saved in the database.
     * @param {TransactionCreateManyAndReturnArgs} args - Arguments to create many Transactions.
     * @example
     * // Create many Transactions
     * const transaction = await prisma.transaction.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Transactions and only return the `id`
     * const transactionWithIdOnly = await prisma.transaction.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TransactionCreateManyAndReturnArgs>(args?: SelectSubset<T, TransactionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Transaction.
     * @param {TransactionDeleteArgs} args - Arguments to delete one Transaction.
     * @example
     * // Delete one Transaction
     * const Transaction = await prisma.transaction.delete({
     *   where: {
     *     // ... filter to delete one Transaction
     *   }
     * })
     * 
     */
    delete<T extends TransactionDeleteArgs>(args: SelectSubset<T, TransactionDeleteArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Transaction.
     * @param {TransactionUpdateArgs} args - Arguments to update one Transaction.
     * @example
     * // Update one Transaction
     * const transaction = await prisma.transaction.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TransactionUpdateArgs>(args: SelectSubset<T, TransactionUpdateArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Transactions.
     * @param {TransactionDeleteManyArgs} args - Arguments to filter Transactions to delete.
     * @example
     * // Delete a few Transactions
     * const { count } = await prisma.transaction.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TransactionDeleteManyArgs>(args?: SelectSubset<T, TransactionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Transactions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Transactions
     * const transaction = await prisma.transaction.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TransactionUpdateManyArgs>(args: SelectSubset<T, TransactionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Transactions and returns the data updated in the database.
     * @param {TransactionUpdateManyAndReturnArgs} args - Arguments to update many Transactions.
     * @example
     * // Update many Transactions
     * const transaction = await prisma.transaction.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Transactions and only return the `id`
     * const transactionWithIdOnly = await prisma.transaction.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TransactionUpdateManyAndReturnArgs>(args: SelectSubset<T, TransactionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Transaction.
     * @param {TransactionUpsertArgs} args - Arguments to update or create a Transaction.
     * @example
     * // Update or create a Transaction
     * const transaction = await prisma.transaction.upsert({
     *   create: {
     *     // ... data to create a Transaction
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Transaction we want to update
     *   }
     * })
     */
    upsert<T extends TransactionUpsertArgs>(args: SelectSubset<T, TransactionUpsertArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Transactions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionCountArgs} args - Arguments to filter Transactions to count.
     * @example
     * // Count the number of Transactions
     * const count = await prisma.transaction.count({
     *   where: {
     *     // ... the filter for the Transactions we want to count
     *   }
     * })
    **/
    count<T extends TransactionCountArgs>(
      args?: Subset<T, TransactionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TransactionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Transaction.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TransactionAggregateArgs>(args: Subset<T, TransactionAggregateArgs>): Prisma.PrismaPromise<GetTransactionAggregateType<T>>

    /**
     * Group by Transaction.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TransactionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TransactionGroupByArgs['orderBy'] }
        : { orderBy?: TransactionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TransactionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTransactionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Transaction model
   */
  readonly fields: TransactionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Transaction.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TransactionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    request<T extends ClearanceRequestDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ClearanceRequestDefaultArgs<ExtArgs>>): Prisma__ClearanceRequestClient<$Result.GetResult<Prisma.$ClearanceRequestPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Transaction model
   */
  interface TransactionFieldRefs {
    readonly id: FieldRef<"Transaction", 'String'>
    readonly amount: FieldRef<"Transaction", 'Decimal'>
    readonly referenceNo: FieldRef<"Transaction", 'String'>
    readonly proofUrl: FieldRef<"Transaction", 'String'>
    readonly verified: FieldRef<"Transaction", 'Boolean'>
    readonly requestId: FieldRef<"Transaction", 'String'>
    readonly createdAt: FieldRef<"Transaction", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Transaction findUnique
   */
  export type TransactionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter, which Transaction to fetch.
     */
    where: TransactionWhereUniqueInput
  }

  /**
   * Transaction findUniqueOrThrow
   */
  export type TransactionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter, which Transaction to fetch.
     */
    where: TransactionWhereUniqueInput
  }

  /**
   * Transaction findFirst
   */
  export type TransactionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter, which Transaction to fetch.
     */
    where?: TransactionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Transactions to fetch.
     */
    orderBy?: TransactionOrderByWithRelationInput | TransactionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Transactions.
     */
    cursor?: TransactionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Transactions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Transactions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Transactions.
     */
    distinct?: TransactionScalarFieldEnum | TransactionScalarFieldEnum[]
  }

  /**
   * Transaction findFirstOrThrow
   */
  export type TransactionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter, which Transaction to fetch.
     */
    where?: TransactionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Transactions to fetch.
     */
    orderBy?: TransactionOrderByWithRelationInput | TransactionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Transactions.
     */
    cursor?: TransactionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Transactions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Transactions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Transactions.
     */
    distinct?: TransactionScalarFieldEnum | TransactionScalarFieldEnum[]
  }

  /**
   * Transaction findMany
   */
  export type TransactionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter, which Transactions to fetch.
     */
    where?: TransactionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Transactions to fetch.
     */
    orderBy?: TransactionOrderByWithRelationInput | TransactionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Transactions.
     */
    cursor?: TransactionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Transactions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Transactions.
     */
    skip?: number
    distinct?: TransactionScalarFieldEnum | TransactionScalarFieldEnum[]
  }

  /**
   * Transaction create
   */
  export type TransactionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * The data needed to create a Transaction.
     */
    data: XOR<TransactionCreateInput, TransactionUncheckedCreateInput>
  }

  /**
   * Transaction createMany
   */
  export type TransactionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Transactions.
     */
    data: TransactionCreateManyInput | TransactionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Transaction createManyAndReturn
   */
  export type TransactionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * The data used to create many Transactions.
     */
    data: TransactionCreateManyInput | TransactionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Transaction update
   */
  export type TransactionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * The data needed to update a Transaction.
     */
    data: XOR<TransactionUpdateInput, TransactionUncheckedUpdateInput>
    /**
     * Choose, which Transaction to update.
     */
    where: TransactionWhereUniqueInput
  }

  /**
   * Transaction updateMany
   */
  export type TransactionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Transactions.
     */
    data: XOR<TransactionUpdateManyMutationInput, TransactionUncheckedUpdateManyInput>
    /**
     * Filter which Transactions to update
     */
    where?: TransactionWhereInput
    /**
     * Limit how many Transactions to update.
     */
    limit?: number
  }

  /**
   * Transaction updateManyAndReturn
   */
  export type TransactionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * The data used to update Transactions.
     */
    data: XOR<TransactionUpdateManyMutationInput, TransactionUncheckedUpdateManyInput>
    /**
     * Filter which Transactions to update
     */
    where?: TransactionWhereInput
    /**
     * Limit how many Transactions to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Transaction upsert
   */
  export type TransactionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * The filter to search for the Transaction to update in case it exists.
     */
    where: TransactionWhereUniqueInput
    /**
     * In case the Transaction found by the `where` argument doesn't exist, create a new Transaction with this data.
     */
    create: XOR<TransactionCreateInput, TransactionUncheckedCreateInput>
    /**
     * In case the Transaction was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TransactionUpdateInput, TransactionUncheckedUpdateInput>
  }

  /**
   * Transaction delete
   */
  export type TransactionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter which Transaction to delete.
     */
    where: TransactionWhereUniqueInput
  }

  /**
   * Transaction deleteMany
   */
  export type TransactionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Transactions to delete
     */
    where?: TransactionWhereInput
    /**
     * Limit how many Transactions to delete.
     */
    limit?: number
  }

  /**
   * Transaction without action
   */
  export type TransactionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const OrganizationScalarFieldEnum: {
    id: 'id',
    name: 'name',
    subdomain: 'subdomain',
    createdAt: 'createdAt'
  };

  export type OrganizationScalarFieldEnum = (typeof OrganizationScalarFieldEnum)[keyof typeof OrganizationScalarFieldEnum]


  export const UserScalarFieldEnum: {
    id: 'id',
    email: 'email',
    name: 'name',
    studentId: 'studentId',
    role: 'role',
    organizationId: 'organizationId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const ClearanceRequestScalarFieldEnum: {
    id: 'id',
    academicYear: 'academicYear',
    semester: 'semester',
    status: 'status',
    qrPayload: 'qrPayload',
    organizationId: 'organizationId',
    studentId: 'studentId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ClearanceRequestScalarFieldEnum = (typeof ClearanceRequestScalarFieldEnum)[keyof typeof ClearanceRequestScalarFieldEnum]


  export const ClearanceStepScalarFieldEnum: {
    id: 'id',
    nodeName: 'nodeName',
    status: 'status',
    remarks: 'remarks',
    requestId: 'requestId',
    clearedById: 'clearedById',
    updatedAt: 'updatedAt'
  };

  export type ClearanceStepScalarFieldEnum = (typeof ClearanceStepScalarFieldEnum)[keyof typeof ClearanceStepScalarFieldEnum]


  export const TransactionScalarFieldEnum: {
    id: 'id',
    amount: 'amount',
    referenceNo: 'referenceNo',
    proofUrl: 'proofUrl',
    verified: 'verified',
    requestId: 'requestId',
    createdAt: 'createdAt'
  };

  export type TransactionScalarFieldEnum = (typeof TransactionScalarFieldEnum)[keyof typeof TransactionScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Role'
   */
  export type EnumRoleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Role'>
    


  /**
   * Reference to a field of type 'Role[]'
   */
  export type ListEnumRoleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Role[]'>
    


  /**
   * Reference to a field of type 'RequestStatus'
   */
  export type EnumRequestStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'RequestStatus'>
    


  /**
   * Reference to a field of type 'RequestStatus[]'
   */
  export type ListEnumRequestStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'RequestStatus[]'>
    


  /**
   * Reference to a field of type 'StepStatus'
   */
  export type EnumStepStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'StepStatus'>
    


  /**
   * Reference to a field of type 'StepStatus[]'
   */
  export type ListEnumStepStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'StepStatus[]'>
    


  /**
   * Reference to a field of type 'Decimal'
   */
  export type DecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal'>
    


  /**
   * Reference to a field of type 'Decimal[]'
   */
  export type ListDecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    
  /**
   * Deep Input Types
   */


  export type OrganizationWhereInput = {
    AND?: OrganizationWhereInput | OrganizationWhereInput[]
    OR?: OrganizationWhereInput[]
    NOT?: OrganizationWhereInput | OrganizationWhereInput[]
    id?: StringFilter<"Organization"> | string
    name?: StringFilter<"Organization"> | string
    subdomain?: StringFilter<"Organization"> | string
    createdAt?: DateTimeFilter<"Organization"> | Date | string
    users?: UserListRelationFilter
    clearances?: ClearanceRequestListRelationFilter
  }

  export type OrganizationOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    subdomain?: SortOrder
    createdAt?: SortOrder
    users?: UserOrderByRelationAggregateInput
    clearances?: ClearanceRequestOrderByRelationAggregateInput
  }

  export type OrganizationWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    subdomain?: string
    AND?: OrganizationWhereInput | OrganizationWhereInput[]
    OR?: OrganizationWhereInput[]
    NOT?: OrganizationWhereInput | OrganizationWhereInput[]
    name?: StringFilter<"Organization"> | string
    createdAt?: DateTimeFilter<"Organization"> | Date | string
    users?: UserListRelationFilter
    clearances?: ClearanceRequestListRelationFilter
  }, "id" | "subdomain">

  export type OrganizationOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    subdomain?: SortOrder
    createdAt?: SortOrder
    _count?: OrganizationCountOrderByAggregateInput
    _max?: OrganizationMaxOrderByAggregateInput
    _min?: OrganizationMinOrderByAggregateInput
  }

  export type OrganizationScalarWhereWithAggregatesInput = {
    AND?: OrganizationScalarWhereWithAggregatesInput | OrganizationScalarWhereWithAggregatesInput[]
    OR?: OrganizationScalarWhereWithAggregatesInput[]
    NOT?: OrganizationScalarWhereWithAggregatesInput | OrganizationScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Organization"> | string
    name?: StringWithAggregatesFilter<"Organization"> | string
    subdomain?: StringWithAggregatesFilter<"Organization"> | string
    createdAt?: DateTimeWithAggregatesFilter<"Organization"> | Date | string
  }

  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: StringFilter<"User"> | string
    email?: StringFilter<"User"> | string
    name?: StringFilter<"User"> | string
    studentId?: StringNullableFilter<"User"> | string | null
    role?: EnumRoleFilter<"User"> | $Enums.Role
    organizationId?: StringFilter<"User"> | string
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    organization?: XOR<OrganizationScalarRelationFilter, OrganizationWhereInput>
    clearances?: ClearanceRequestListRelationFilter
    stepsApproved?: ClearanceStepListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrder
    studentId?: SortOrderInput | SortOrder
    role?: SortOrder
    organizationId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    organization?: OrganizationOrderByWithRelationInput
    clearances?: ClearanceRequestOrderByRelationAggregateInput
    stepsApproved?: ClearanceStepOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    name?: StringFilter<"User"> | string
    studentId?: StringNullableFilter<"User"> | string | null
    role?: EnumRoleFilter<"User"> | $Enums.Role
    organizationId?: StringFilter<"User"> | string
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    organization?: XOR<OrganizationScalarRelationFilter, OrganizationWhereInput>
    clearances?: ClearanceRequestListRelationFilter
    stepsApproved?: ClearanceStepListRelationFilter
  }, "id" | "email">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrder
    studentId?: SortOrderInput | SortOrder
    role?: SortOrder
    organizationId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"User"> | string
    email?: StringWithAggregatesFilter<"User"> | string
    name?: StringWithAggregatesFilter<"User"> | string
    studentId?: StringNullableWithAggregatesFilter<"User"> | string | null
    role?: EnumRoleWithAggregatesFilter<"User"> | $Enums.Role
    organizationId?: StringWithAggregatesFilter<"User"> | string
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type ClearanceRequestWhereInput = {
    AND?: ClearanceRequestWhereInput | ClearanceRequestWhereInput[]
    OR?: ClearanceRequestWhereInput[]
    NOT?: ClearanceRequestWhereInput | ClearanceRequestWhereInput[]
    id?: StringFilter<"ClearanceRequest"> | string
    academicYear?: StringFilter<"ClearanceRequest"> | string
    semester?: StringFilter<"ClearanceRequest"> | string
    status?: EnumRequestStatusFilter<"ClearanceRequest"> | $Enums.RequestStatus
    qrPayload?: StringNullableFilter<"ClearanceRequest"> | string | null
    organizationId?: StringFilter<"ClearanceRequest"> | string
    studentId?: StringFilter<"ClearanceRequest"> | string
    createdAt?: DateTimeFilter<"ClearanceRequest"> | Date | string
    updatedAt?: DateTimeFilter<"ClearanceRequest"> | Date | string
    organization?: XOR<OrganizationScalarRelationFilter, OrganizationWhereInput>
    student?: XOR<UserScalarRelationFilter, UserWhereInput>
    steps?: ClearanceStepListRelationFilter
    transactions?: TransactionListRelationFilter
  }

  export type ClearanceRequestOrderByWithRelationInput = {
    id?: SortOrder
    academicYear?: SortOrder
    semester?: SortOrder
    status?: SortOrder
    qrPayload?: SortOrderInput | SortOrder
    organizationId?: SortOrder
    studentId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    organization?: OrganizationOrderByWithRelationInput
    student?: UserOrderByWithRelationInput
    steps?: ClearanceStepOrderByRelationAggregateInput
    transactions?: TransactionOrderByRelationAggregateInput
  }

  export type ClearanceRequestWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    qrPayload?: string
    AND?: ClearanceRequestWhereInput | ClearanceRequestWhereInput[]
    OR?: ClearanceRequestWhereInput[]
    NOT?: ClearanceRequestWhereInput | ClearanceRequestWhereInput[]
    academicYear?: StringFilter<"ClearanceRequest"> | string
    semester?: StringFilter<"ClearanceRequest"> | string
    status?: EnumRequestStatusFilter<"ClearanceRequest"> | $Enums.RequestStatus
    organizationId?: StringFilter<"ClearanceRequest"> | string
    studentId?: StringFilter<"ClearanceRequest"> | string
    createdAt?: DateTimeFilter<"ClearanceRequest"> | Date | string
    updatedAt?: DateTimeFilter<"ClearanceRequest"> | Date | string
    organization?: XOR<OrganizationScalarRelationFilter, OrganizationWhereInput>
    student?: XOR<UserScalarRelationFilter, UserWhereInput>
    steps?: ClearanceStepListRelationFilter
    transactions?: TransactionListRelationFilter
  }, "id" | "qrPayload">

  export type ClearanceRequestOrderByWithAggregationInput = {
    id?: SortOrder
    academicYear?: SortOrder
    semester?: SortOrder
    status?: SortOrder
    qrPayload?: SortOrderInput | SortOrder
    organizationId?: SortOrder
    studentId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ClearanceRequestCountOrderByAggregateInput
    _max?: ClearanceRequestMaxOrderByAggregateInput
    _min?: ClearanceRequestMinOrderByAggregateInput
  }

  export type ClearanceRequestScalarWhereWithAggregatesInput = {
    AND?: ClearanceRequestScalarWhereWithAggregatesInput | ClearanceRequestScalarWhereWithAggregatesInput[]
    OR?: ClearanceRequestScalarWhereWithAggregatesInput[]
    NOT?: ClearanceRequestScalarWhereWithAggregatesInput | ClearanceRequestScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ClearanceRequest"> | string
    academicYear?: StringWithAggregatesFilter<"ClearanceRequest"> | string
    semester?: StringWithAggregatesFilter<"ClearanceRequest"> | string
    status?: EnumRequestStatusWithAggregatesFilter<"ClearanceRequest"> | $Enums.RequestStatus
    qrPayload?: StringNullableWithAggregatesFilter<"ClearanceRequest"> | string | null
    organizationId?: StringWithAggregatesFilter<"ClearanceRequest"> | string
    studentId?: StringWithAggregatesFilter<"ClearanceRequest"> | string
    createdAt?: DateTimeWithAggregatesFilter<"ClearanceRequest"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"ClearanceRequest"> | Date | string
  }

  export type ClearanceStepWhereInput = {
    AND?: ClearanceStepWhereInput | ClearanceStepWhereInput[]
    OR?: ClearanceStepWhereInput[]
    NOT?: ClearanceStepWhereInput | ClearanceStepWhereInput[]
    id?: StringFilter<"ClearanceStep"> | string
    nodeName?: StringFilter<"ClearanceStep"> | string
    status?: EnumStepStatusFilter<"ClearanceStep"> | $Enums.StepStatus
    remarks?: StringNullableFilter<"ClearanceStep"> | string | null
    requestId?: StringFilter<"ClearanceStep"> | string
    clearedById?: StringNullableFilter<"ClearanceStep"> | string | null
    updatedAt?: DateTimeFilter<"ClearanceStep"> | Date | string
    request?: XOR<ClearanceRequestScalarRelationFilter, ClearanceRequestWhereInput>
    clearedBy?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
  }

  export type ClearanceStepOrderByWithRelationInput = {
    id?: SortOrder
    nodeName?: SortOrder
    status?: SortOrder
    remarks?: SortOrderInput | SortOrder
    requestId?: SortOrder
    clearedById?: SortOrderInput | SortOrder
    updatedAt?: SortOrder
    request?: ClearanceRequestOrderByWithRelationInput
    clearedBy?: UserOrderByWithRelationInput
  }

  export type ClearanceStepWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ClearanceStepWhereInput | ClearanceStepWhereInput[]
    OR?: ClearanceStepWhereInput[]
    NOT?: ClearanceStepWhereInput | ClearanceStepWhereInput[]
    nodeName?: StringFilter<"ClearanceStep"> | string
    status?: EnumStepStatusFilter<"ClearanceStep"> | $Enums.StepStatus
    remarks?: StringNullableFilter<"ClearanceStep"> | string | null
    requestId?: StringFilter<"ClearanceStep"> | string
    clearedById?: StringNullableFilter<"ClearanceStep"> | string | null
    updatedAt?: DateTimeFilter<"ClearanceStep"> | Date | string
    request?: XOR<ClearanceRequestScalarRelationFilter, ClearanceRequestWhereInput>
    clearedBy?: XOR<UserNullableScalarRelationFilter, UserWhereInput> | null
  }, "id">

  export type ClearanceStepOrderByWithAggregationInput = {
    id?: SortOrder
    nodeName?: SortOrder
    status?: SortOrder
    remarks?: SortOrderInput | SortOrder
    requestId?: SortOrder
    clearedById?: SortOrderInput | SortOrder
    updatedAt?: SortOrder
    _count?: ClearanceStepCountOrderByAggregateInput
    _max?: ClearanceStepMaxOrderByAggregateInput
    _min?: ClearanceStepMinOrderByAggregateInput
  }

  export type ClearanceStepScalarWhereWithAggregatesInput = {
    AND?: ClearanceStepScalarWhereWithAggregatesInput | ClearanceStepScalarWhereWithAggregatesInput[]
    OR?: ClearanceStepScalarWhereWithAggregatesInput[]
    NOT?: ClearanceStepScalarWhereWithAggregatesInput | ClearanceStepScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ClearanceStep"> | string
    nodeName?: StringWithAggregatesFilter<"ClearanceStep"> | string
    status?: EnumStepStatusWithAggregatesFilter<"ClearanceStep"> | $Enums.StepStatus
    remarks?: StringNullableWithAggregatesFilter<"ClearanceStep"> | string | null
    requestId?: StringWithAggregatesFilter<"ClearanceStep"> | string
    clearedById?: StringNullableWithAggregatesFilter<"ClearanceStep"> | string | null
    updatedAt?: DateTimeWithAggregatesFilter<"ClearanceStep"> | Date | string
  }

  export type TransactionWhereInput = {
    AND?: TransactionWhereInput | TransactionWhereInput[]
    OR?: TransactionWhereInput[]
    NOT?: TransactionWhereInput | TransactionWhereInput[]
    id?: StringFilter<"Transaction"> | string
    amount?: DecimalFilter<"Transaction"> | Decimal | DecimalJsLike | number | string
    referenceNo?: StringFilter<"Transaction"> | string
    proofUrl?: StringNullableFilter<"Transaction"> | string | null
    verified?: BoolFilter<"Transaction"> | boolean
    requestId?: StringFilter<"Transaction"> | string
    createdAt?: DateTimeFilter<"Transaction"> | Date | string
    request?: XOR<ClearanceRequestScalarRelationFilter, ClearanceRequestWhereInput>
  }

  export type TransactionOrderByWithRelationInput = {
    id?: SortOrder
    amount?: SortOrder
    referenceNo?: SortOrder
    proofUrl?: SortOrderInput | SortOrder
    verified?: SortOrder
    requestId?: SortOrder
    createdAt?: SortOrder
    request?: ClearanceRequestOrderByWithRelationInput
  }

  export type TransactionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    referenceNo?: string
    AND?: TransactionWhereInput | TransactionWhereInput[]
    OR?: TransactionWhereInput[]
    NOT?: TransactionWhereInput | TransactionWhereInput[]
    amount?: DecimalFilter<"Transaction"> | Decimal | DecimalJsLike | number | string
    proofUrl?: StringNullableFilter<"Transaction"> | string | null
    verified?: BoolFilter<"Transaction"> | boolean
    requestId?: StringFilter<"Transaction"> | string
    createdAt?: DateTimeFilter<"Transaction"> | Date | string
    request?: XOR<ClearanceRequestScalarRelationFilter, ClearanceRequestWhereInput>
  }, "id" | "referenceNo">

  export type TransactionOrderByWithAggregationInput = {
    id?: SortOrder
    amount?: SortOrder
    referenceNo?: SortOrder
    proofUrl?: SortOrderInput | SortOrder
    verified?: SortOrder
    requestId?: SortOrder
    createdAt?: SortOrder
    _count?: TransactionCountOrderByAggregateInput
    _avg?: TransactionAvgOrderByAggregateInput
    _max?: TransactionMaxOrderByAggregateInput
    _min?: TransactionMinOrderByAggregateInput
    _sum?: TransactionSumOrderByAggregateInput
  }

  export type TransactionScalarWhereWithAggregatesInput = {
    AND?: TransactionScalarWhereWithAggregatesInput | TransactionScalarWhereWithAggregatesInput[]
    OR?: TransactionScalarWhereWithAggregatesInput[]
    NOT?: TransactionScalarWhereWithAggregatesInput | TransactionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Transaction"> | string
    amount?: DecimalWithAggregatesFilter<"Transaction"> | Decimal | DecimalJsLike | number | string
    referenceNo?: StringWithAggregatesFilter<"Transaction"> | string
    proofUrl?: StringNullableWithAggregatesFilter<"Transaction"> | string | null
    verified?: BoolWithAggregatesFilter<"Transaction"> | boolean
    requestId?: StringWithAggregatesFilter<"Transaction"> | string
    createdAt?: DateTimeWithAggregatesFilter<"Transaction"> | Date | string
  }

  export type OrganizationCreateInput = {
    id?: string
    name: string
    subdomain: string
    createdAt?: Date | string
    users?: UserCreateNestedManyWithoutOrganizationInput
    clearances?: ClearanceRequestCreateNestedManyWithoutOrganizationInput
  }

  export type OrganizationUncheckedCreateInput = {
    id?: string
    name: string
    subdomain: string
    createdAt?: Date | string
    users?: UserUncheckedCreateNestedManyWithoutOrganizationInput
    clearances?: ClearanceRequestUncheckedCreateNestedManyWithoutOrganizationInput
  }

  export type OrganizationUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    subdomain?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    users?: UserUpdateManyWithoutOrganizationNestedInput
    clearances?: ClearanceRequestUpdateManyWithoutOrganizationNestedInput
  }

  export type OrganizationUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    subdomain?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    users?: UserUncheckedUpdateManyWithoutOrganizationNestedInput
    clearances?: ClearanceRequestUncheckedUpdateManyWithoutOrganizationNestedInput
  }

  export type OrganizationCreateManyInput = {
    id?: string
    name: string
    subdomain: string
    createdAt?: Date | string
  }

  export type OrganizationUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    subdomain?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OrganizationUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    subdomain?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserCreateInput = {
    id?: string
    email: string
    name: string
    studentId?: string | null
    role?: $Enums.Role
    createdAt?: Date | string
    updatedAt?: Date | string
    organization: OrganizationCreateNestedOneWithoutUsersInput
    clearances?: ClearanceRequestCreateNestedManyWithoutStudentInput
    stepsApproved?: ClearanceStepCreateNestedManyWithoutClearedByInput
  }

  export type UserUncheckedCreateInput = {
    id?: string
    email: string
    name: string
    studentId?: string | null
    role?: $Enums.Role
    organizationId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    clearances?: ClearanceRequestUncheckedCreateNestedManyWithoutStudentInput
    stepsApproved?: ClearanceStepUncheckedCreateNestedManyWithoutClearedByInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    studentId?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organization?: OrganizationUpdateOneRequiredWithoutUsersNestedInput
    clearances?: ClearanceRequestUpdateManyWithoutStudentNestedInput
    stepsApproved?: ClearanceStepUpdateManyWithoutClearedByNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    studentId?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    organizationId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    clearances?: ClearanceRequestUncheckedUpdateManyWithoutStudentNestedInput
    stepsApproved?: ClearanceStepUncheckedUpdateManyWithoutClearedByNestedInput
  }

  export type UserCreateManyInput = {
    id?: string
    email: string
    name: string
    studentId?: string | null
    role?: $Enums.Role
    organizationId: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    studentId?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    studentId?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    organizationId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClearanceRequestCreateInput = {
    id?: string
    academicYear: string
    semester: string
    status?: $Enums.RequestStatus
    qrPayload?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    organization: OrganizationCreateNestedOneWithoutClearancesInput
    student: UserCreateNestedOneWithoutClearancesInput
    steps?: ClearanceStepCreateNestedManyWithoutRequestInput
    transactions?: TransactionCreateNestedManyWithoutRequestInput
  }

  export type ClearanceRequestUncheckedCreateInput = {
    id?: string
    academicYear: string
    semester: string
    status?: $Enums.RequestStatus
    qrPayload?: string | null
    organizationId: string
    studentId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    steps?: ClearanceStepUncheckedCreateNestedManyWithoutRequestInput
    transactions?: TransactionUncheckedCreateNestedManyWithoutRequestInput
  }

  export type ClearanceRequestUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    academicYear?: StringFieldUpdateOperationsInput | string
    semester?: StringFieldUpdateOperationsInput | string
    status?: EnumRequestStatusFieldUpdateOperationsInput | $Enums.RequestStatus
    qrPayload?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organization?: OrganizationUpdateOneRequiredWithoutClearancesNestedInput
    student?: UserUpdateOneRequiredWithoutClearancesNestedInput
    steps?: ClearanceStepUpdateManyWithoutRequestNestedInput
    transactions?: TransactionUpdateManyWithoutRequestNestedInput
  }

  export type ClearanceRequestUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    academicYear?: StringFieldUpdateOperationsInput | string
    semester?: StringFieldUpdateOperationsInput | string
    status?: EnumRequestStatusFieldUpdateOperationsInput | $Enums.RequestStatus
    qrPayload?: NullableStringFieldUpdateOperationsInput | string | null
    organizationId?: StringFieldUpdateOperationsInput | string
    studentId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    steps?: ClearanceStepUncheckedUpdateManyWithoutRequestNestedInput
    transactions?: TransactionUncheckedUpdateManyWithoutRequestNestedInput
  }

  export type ClearanceRequestCreateManyInput = {
    id?: string
    academicYear: string
    semester: string
    status?: $Enums.RequestStatus
    qrPayload?: string | null
    organizationId: string
    studentId: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ClearanceRequestUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    academicYear?: StringFieldUpdateOperationsInput | string
    semester?: StringFieldUpdateOperationsInput | string
    status?: EnumRequestStatusFieldUpdateOperationsInput | $Enums.RequestStatus
    qrPayload?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClearanceRequestUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    academicYear?: StringFieldUpdateOperationsInput | string
    semester?: StringFieldUpdateOperationsInput | string
    status?: EnumRequestStatusFieldUpdateOperationsInput | $Enums.RequestStatus
    qrPayload?: NullableStringFieldUpdateOperationsInput | string | null
    organizationId?: StringFieldUpdateOperationsInput | string
    studentId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClearanceStepCreateInput = {
    id?: string
    nodeName: string
    status?: $Enums.StepStatus
    remarks?: string | null
    updatedAt?: Date | string
    request: ClearanceRequestCreateNestedOneWithoutStepsInput
    clearedBy?: UserCreateNestedOneWithoutStepsApprovedInput
  }

  export type ClearanceStepUncheckedCreateInput = {
    id?: string
    nodeName: string
    status?: $Enums.StepStatus
    remarks?: string | null
    requestId: string
    clearedById?: string | null
    updatedAt?: Date | string
  }

  export type ClearanceStepUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    nodeName?: StringFieldUpdateOperationsInput | string
    status?: EnumStepStatusFieldUpdateOperationsInput | $Enums.StepStatus
    remarks?: NullableStringFieldUpdateOperationsInput | string | null
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    request?: ClearanceRequestUpdateOneRequiredWithoutStepsNestedInput
    clearedBy?: UserUpdateOneWithoutStepsApprovedNestedInput
  }

  export type ClearanceStepUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    nodeName?: StringFieldUpdateOperationsInput | string
    status?: EnumStepStatusFieldUpdateOperationsInput | $Enums.StepStatus
    remarks?: NullableStringFieldUpdateOperationsInput | string | null
    requestId?: StringFieldUpdateOperationsInput | string
    clearedById?: NullableStringFieldUpdateOperationsInput | string | null
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClearanceStepCreateManyInput = {
    id?: string
    nodeName: string
    status?: $Enums.StepStatus
    remarks?: string | null
    requestId: string
    clearedById?: string | null
    updatedAt?: Date | string
  }

  export type ClearanceStepUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    nodeName?: StringFieldUpdateOperationsInput | string
    status?: EnumStepStatusFieldUpdateOperationsInput | $Enums.StepStatus
    remarks?: NullableStringFieldUpdateOperationsInput | string | null
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClearanceStepUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    nodeName?: StringFieldUpdateOperationsInput | string
    status?: EnumStepStatusFieldUpdateOperationsInput | $Enums.StepStatus
    remarks?: NullableStringFieldUpdateOperationsInput | string | null
    requestId?: StringFieldUpdateOperationsInput | string
    clearedById?: NullableStringFieldUpdateOperationsInput | string | null
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionCreateInput = {
    id?: string
    amount: Decimal | DecimalJsLike | number | string
    referenceNo: string
    proofUrl?: string | null
    verified?: boolean
    createdAt?: Date | string
    request: ClearanceRequestCreateNestedOneWithoutTransactionsInput
  }

  export type TransactionUncheckedCreateInput = {
    id?: string
    amount: Decimal | DecimalJsLike | number | string
    referenceNo: string
    proofUrl?: string | null
    verified?: boolean
    requestId: string
    createdAt?: Date | string
  }

  export type TransactionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    amount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    referenceNo?: StringFieldUpdateOperationsInput | string
    proofUrl?: NullableStringFieldUpdateOperationsInput | string | null
    verified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    request?: ClearanceRequestUpdateOneRequiredWithoutTransactionsNestedInput
  }

  export type TransactionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    amount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    referenceNo?: StringFieldUpdateOperationsInput | string
    proofUrl?: NullableStringFieldUpdateOperationsInput | string | null
    verified?: BoolFieldUpdateOperationsInput | boolean
    requestId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionCreateManyInput = {
    id?: string
    amount: Decimal | DecimalJsLike | number | string
    referenceNo: string
    proofUrl?: string | null
    verified?: boolean
    requestId: string
    createdAt?: Date | string
  }

  export type TransactionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    amount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    referenceNo?: StringFieldUpdateOperationsInput | string
    proofUrl?: NullableStringFieldUpdateOperationsInput | string | null
    verified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    amount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    referenceNo?: StringFieldUpdateOperationsInput | string
    proofUrl?: NullableStringFieldUpdateOperationsInput | string | null
    verified?: BoolFieldUpdateOperationsInput | boolean
    requestId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type UserListRelationFilter = {
    every?: UserWhereInput
    some?: UserWhereInput
    none?: UserWhereInput
  }

  export type ClearanceRequestListRelationFilter = {
    every?: ClearanceRequestWhereInput
    some?: ClearanceRequestWhereInput
    none?: ClearanceRequestWhereInput
  }

  export type UserOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ClearanceRequestOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type OrganizationCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    subdomain?: SortOrder
    createdAt?: SortOrder
  }

  export type OrganizationMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    subdomain?: SortOrder
    createdAt?: SortOrder
  }

  export type OrganizationMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    subdomain?: SortOrder
    createdAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type EnumRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.Role | EnumRoleFieldRefInput<$PrismaModel>
    in?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleFilter<$PrismaModel> | $Enums.Role
  }

  export type OrganizationScalarRelationFilter = {
    is?: OrganizationWhereInput
    isNot?: OrganizationWhereInput
  }

  export type ClearanceStepListRelationFilter = {
    every?: ClearanceStepWhereInput
    some?: ClearanceStepWhereInput
    none?: ClearanceStepWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type ClearanceStepOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrder
    studentId?: SortOrder
    role?: SortOrder
    organizationId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrder
    studentId?: SortOrder
    role?: SortOrder
    organizationId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrder
    studentId?: SortOrder
    role?: SortOrder
    organizationId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type EnumRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.Role | EnumRoleFieldRefInput<$PrismaModel>
    in?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleWithAggregatesFilter<$PrismaModel> | $Enums.Role
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRoleFilter<$PrismaModel>
    _max?: NestedEnumRoleFilter<$PrismaModel>
  }

  export type EnumRequestStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.RequestStatus | EnumRequestStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RequestStatus[] | ListEnumRequestStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RequestStatus[] | ListEnumRequestStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRequestStatusFilter<$PrismaModel> | $Enums.RequestStatus
  }

  export type UserScalarRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type TransactionListRelationFilter = {
    every?: TransactionWhereInput
    some?: TransactionWhereInput
    none?: TransactionWhereInput
  }

  export type TransactionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ClearanceRequestCountOrderByAggregateInput = {
    id?: SortOrder
    academicYear?: SortOrder
    semester?: SortOrder
    status?: SortOrder
    qrPayload?: SortOrder
    organizationId?: SortOrder
    studentId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ClearanceRequestMaxOrderByAggregateInput = {
    id?: SortOrder
    academicYear?: SortOrder
    semester?: SortOrder
    status?: SortOrder
    qrPayload?: SortOrder
    organizationId?: SortOrder
    studentId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ClearanceRequestMinOrderByAggregateInput = {
    id?: SortOrder
    academicYear?: SortOrder
    semester?: SortOrder
    status?: SortOrder
    qrPayload?: SortOrder
    organizationId?: SortOrder
    studentId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type EnumRequestStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RequestStatus | EnumRequestStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RequestStatus[] | ListEnumRequestStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RequestStatus[] | ListEnumRequestStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRequestStatusWithAggregatesFilter<$PrismaModel> | $Enums.RequestStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRequestStatusFilter<$PrismaModel>
    _max?: NestedEnumRequestStatusFilter<$PrismaModel>
  }

  export type EnumStepStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.StepStatus | EnumStepStatusFieldRefInput<$PrismaModel>
    in?: $Enums.StepStatus[] | ListEnumStepStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.StepStatus[] | ListEnumStepStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumStepStatusFilter<$PrismaModel> | $Enums.StepStatus
  }

  export type ClearanceRequestScalarRelationFilter = {
    is?: ClearanceRequestWhereInput
    isNot?: ClearanceRequestWhereInput
  }

  export type UserNullableScalarRelationFilter = {
    is?: UserWhereInput | null
    isNot?: UserWhereInput | null
  }

  export type ClearanceStepCountOrderByAggregateInput = {
    id?: SortOrder
    nodeName?: SortOrder
    status?: SortOrder
    remarks?: SortOrder
    requestId?: SortOrder
    clearedById?: SortOrder
    updatedAt?: SortOrder
  }

  export type ClearanceStepMaxOrderByAggregateInput = {
    id?: SortOrder
    nodeName?: SortOrder
    status?: SortOrder
    remarks?: SortOrder
    requestId?: SortOrder
    clearedById?: SortOrder
    updatedAt?: SortOrder
  }

  export type ClearanceStepMinOrderByAggregateInput = {
    id?: SortOrder
    nodeName?: SortOrder
    status?: SortOrder
    remarks?: SortOrder
    requestId?: SortOrder
    clearedById?: SortOrder
    updatedAt?: SortOrder
  }

  export type EnumStepStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.StepStatus | EnumStepStatusFieldRefInput<$PrismaModel>
    in?: $Enums.StepStatus[] | ListEnumStepStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.StepStatus[] | ListEnumStepStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumStepStatusWithAggregatesFilter<$PrismaModel> | $Enums.StepStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumStepStatusFilter<$PrismaModel>
    _max?: NestedEnumStepStatusFilter<$PrismaModel>
  }

  export type DecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type TransactionCountOrderByAggregateInput = {
    id?: SortOrder
    amount?: SortOrder
    referenceNo?: SortOrder
    proofUrl?: SortOrder
    verified?: SortOrder
    requestId?: SortOrder
    createdAt?: SortOrder
  }

  export type TransactionAvgOrderByAggregateInput = {
    amount?: SortOrder
  }

  export type TransactionMaxOrderByAggregateInput = {
    id?: SortOrder
    amount?: SortOrder
    referenceNo?: SortOrder
    proofUrl?: SortOrder
    verified?: SortOrder
    requestId?: SortOrder
    createdAt?: SortOrder
  }

  export type TransactionMinOrderByAggregateInput = {
    id?: SortOrder
    amount?: SortOrder
    referenceNo?: SortOrder
    proofUrl?: SortOrder
    verified?: SortOrder
    requestId?: SortOrder
    createdAt?: SortOrder
  }

  export type TransactionSumOrderByAggregateInput = {
    amount?: SortOrder
  }

  export type DecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type UserCreateNestedManyWithoutOrganizationInput = {
    create?: XOR<UserCreateWithoutOrganizationInput, UserUncheckedCreateWithoutOrganizationInput> | UserCreateWithoutOrganizationInput[] | UserUncheckedCreateWithoutOrganizationInput[]
    connectOrCreate?: UserCreateOrConnectWithoutOrganizationInput | UserCreateOrConnectWithoutOrganizationInput[]
    createMany?: UserCreateManyOrganizationInputEnvelope
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
  }

  export type ClearanceRequestCreateNestedManyWithoutOrganizationInput = {
    create?: XOR<ClearanceRequestCreateWithoutOrganizationInput, ClearanceRequestUncheckedCreateWithoutOrganizationInput> | ClearanceRequestCreateWithoutOrganizationInput[] | ClearanceRequestUncheckedCreateWithoutOrganizationInput[]
    connectOrCreate?: ClearanceRequestCreateOrConnectWithoutOrganizationInput | ClearanceRequestCreateOrConnectWithoutOrganizationInput[]
    createMany?: ClearanceRequestCreateManyOrganizationInputEnvelope
    connect?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
  }

  export type UserUncheckedCreateNestedManyWithoutOrganizationInput = {
    create?: XOR<UserCreateWithoutOrganizationInput, UserUncheckedCreateWithoutOrganizationInput> | UserCreateWithoutOrganizationInput[] | UserUncheckedCreateWithoutOrganizationInput[]
    connectOrCreate?: UserCreateOrConnectWithoutOrganizationInput | UserCreateOrConnectWithoutOrganizationInput[]
    createMany?: UserCreateManyOrganizationInputEnvelope
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
  }

  export type ClearanceRequestUncheckedCreateNestedManyWithoutOrganizationInput = {
    create?: XOR<ClearanceRequestCreateWithoutOrganizationInput, ClearanceRequestUncheckedCreateWithoutOrganizationInput> | ClearanceRequestCreateWithoutOrganizationInput[] | ClearanceRequestUncheckedCreateWithoutOrganizationInput[]
    connectOrCreate?: ClearanceRequestCreateOrConnectWithoutOrganizationInput | ClearanceRequestCreateOrConnectWithoutOrganizationInput[]
    createMany?: ClearanceRequestCreateManyOrganizationInputEnvelope
    connect?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type UserUpdateManyWithoutOrganizationNestedInput = {
    create?: XOR<UserCreateWithoutOrganizationInput, UserUncheckedCreateWithoutOrganizationInput> | UserCreateWithoutOrganizationInput[] | UserUncheckedCreateWithoutOrganizationInput[]
    connectOrCreate?: UserCreateOrConnectWithoutOrganizationInput | UserCreateOrConnectWithoutOrganizationInput[]
    upsert?: UserUpsertWithWhereUniqueWithoutOrganizationInput | UserUpsertWithWhereUniqueWithoutOrganizationInput[]
    createMany?: UserCreateManyOrganizationInputEnvelope
    set?: UserWhereUniqueInput | UserWhereUniqueInput[]
    disconnect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    delete?: UserWhereUniqueInput | UserWhereUniqueInput[]
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    update?: UserUpdateWithWhereUniqueWithoutOrganizationInput | UserUpdateWithWhereUniqueWithoutOrganizationInput[]
    updateMany?: UserUpdateManyWithWhereWithoutOrganizationInput | UserUpdateManyWithWhereWithoutOrganizationInput[]
    deleteMany?: UserScalarWhereInput | UserScalarWhereInput[]
  }

  export type ClearanceRequestUpdateManyWithoutOrganizationNestedInput = {
    create?: XOR<ClearanceRequestCreateWithoutOrganizationInput, ClearanceRequestUncheckedCreateWithoutOrganizationInput> | ClearanceRequestCreateWithoutOrganizationInput[] | ClearanceRequestUncheckedCreateWithoutOrganizationInput[]
    connectOrCreate?: ClearanceRequestCreateOrConnectWithoutOrganizationInput | ClearanceRequestCreateOrConnectWithoutOrganizationInput[]
    upsert?: ClearanceRequestUpsertWithWhereUniqueWithoutOrganizationInput | ClearanceRequestUpsertWithWhereUniqueWithoutOrganizationInput[]
    createMany?: ClearanceRequestCreateManyOrganizationInputEnvelope
    set?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
    disconnect?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
    delete?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
    connect?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
    update?: ClearanceRequestUpdateWithWhereUniqueWithoutOrganizationInput | ClearanceRequestUpdateWithWhereUniqueWithoutOrganizationInput[]
    updateMany?: ClearanceRequestUpdateManyWithWhereWithoutOrganizationInput | ClearanceRequestUpdateManyWithWhereWithoutOrganizationInput[]
    deleteMany?: ClearanceRequestScalarWhereInput | ClearanceRequestScalarWhereInput[]
  }

  export type UserUncheckedUpdateManyWithoutOrganizationNestedInput = {
    create?: XOR<UserCreateWithoutOrganizationInput, UserUncheckedCreateWithoutOrganizationInput> | UserCreateWithoutOrganizationInput[] | UserUncheckedCreateWithoutOrganizationInput[]
    connectOrCreate?: UserCreateOrConnectWithoutOrganizationInput | UserCreateOrConnectWithoutOrganizationInput[]
    upsert?: UserUpsertWithWhereUniqueWithoutOrganizationInput | UserUpsertWithWhereUniqueWithoutOrganizationInput[]
    createMany?: UserCreateManyOrganizationInputEnvelope
    set?: UserWhereUniqueInput | UserWhereUniqueInput[]
    disconnect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    delete?: UserWhereUniqueInput | UserWhereUniqueInput[]
    connect?: UserWhereUniqueInput | UserWhereUniqueInput[]
    update?: UserUpdateWithWhereUniqueWithoutOrganizationInput | UserUpdateWithWhereUniqueWithoutOrganizationInput[]
    updateMany?: UserUpdateManyWithWhereWithoutOrganizationInput | UserUpdateManyWithWhereWithoutOrganizationInput[]
    deleteMany?: UserScalarWhereInput | UserScalarWhereInput[]
  }

  export type ClearanceRequestUncheckedUpdateManyWithoutOrganizationNestedInput = {
    create?: XOR<ClearanceRequestCreateWithoutOrganizationInput, ClearanceRequestUncheckedCreateWithoutOrganizationInput> | ClearanceRequestCreateWithoutOrganizationInput[] | ClearanceRequestUncheckedCreateWithoutOrganizationInput[]
    connectOrCreate?: ClearanceRequestCreateOrConnectWithoutOrganizationInput | ClearanceRequestCreateOrConnectWithoutOrganizationInput[]
    upsert?: ClearanceRequestUpsertWithWhereUniqueWithoutOrganizationInput | ClearanceRequestUpsertWithWhereUniqueWithoutOrganizationInput[]
    createMany?: ClearanceRequestCreateManyOrganizationInputEnvelope
    set?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
    disconnect?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
    delete?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
    connect?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
    update?: ClearanceRequestUpdateWithWhereUniqueWithoutOrganizationInput | ClearanceRequestUpdateWithWhereUniqueWithoutOrganizationInput[]
    updateMany?: ClearanceRequestUpdateManyWithWhereWithoutOrganizationInput | ClearanceRequestUpdateManyWithWhereWithoutOrganizationInput[]
    deleteMany?: ClearanceRequestScalarWhereInput | ClearanceRequestScalarWhereInput[]
  }

  export type OrganizationCreateNestedOneWithoutUsersInput = {
    create?: XOR<OrganizationCreateWithoutUsersInput, OrganizationUncheckedCreateWithoutUsersInput>
    connectOrCreate?: OrganizationCreateOrConnectWithoutUsersInput
    connect?: OrganizationWhereUniqueInput
  }

  export type ClearanceRequestCreateNestedManyWithoutStudentInput = {
    create?: XOR<ClearanceRequestCreateWithoutStudentInput, ClearanceRequestUncheckedCreateWithoutStudentInput> | ClearanceRequestCreateWithoutStudentInput[] | ClearanceRequestUncheckedCreateWithoutStudentInput[]
    connectOrCreate?: ClearanceRequestCreateOrConnectWithoutStudentInput | ClearanceRequestCreateOrConnectWithoutStudentInput[]
    createMany?: ClearanceRequestCreateManyStudentInputEnvelope
    connect?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
  }

  export type ClearanceStepCreateNestedManyWithoutClearedByInput = {
    create?: XOR<ClearanceStepCreateWithoutClearedByInput, ClearanceStepUncheckedCreateWithoutClearedByInput> | ClearanceStepCreateWithoutClearedByInput[] | ClearanceStepUncheckedCreateWithoutClearedByInput[]
    connectOrCreate?: ClearanceStepCreateOrConnectWithoutClearedByInput | ClearanceStepCreateOrConnectWithoutClearedByInput[]
    createMany?: ClearanceStepCreateManyClearedByInputEnvelope
    connect?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
  }

  export type ClearanceRequestUncheckedCreateNestedManyWithoutStudentInput = {
    create?: XOR<ClearanceRequestCreateWithoutStudentInput, ClearanceRequestUncheckedCreateWithoutStudentInput> | ClearanceRequestCreateWithoutStudentInput[] | ClearanceRequestUncheckedCreateWithoutStudentInput[]
    connectOrCreate?: ClearanceRequestCreateOrConnectWithoutStudentInput | ClearanceRequestCreateOrConnectWithoutStudentInput[]
    createMany?: ClearanceRequestCreateManyStudentInputEnvelope
    connect?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
  }

  export type ClearanceStepUncheckedCreateNestedManyWithoutClearedByInput = {
    create?: XOR<ClearanceStepCreateWithoutClearedByInput, ClearanceStepUncheckedCreateWithoutClearedByInput> | ClearanceStepCreateWithoutClearedByInput[] | ClearanceStepUncheckedCreateWithoutClearedByInput[]
    connectOrCreate?: ClearanceStepCreateOrConnectWithoutClearedByInput | ClearanceStepCreateOrConnectWithoutClearedByInput[]
    createMany?: ClearanceStepCreateManyClearedByInputEnvelope
    connect?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type EnumRoleFieldUpdateOperationsInput = {
    set?: $Enums.Role
  }

  export type OrganizationUpdateOneRequiredWithoutUsersNestedInput = {
    create?: XOR<OrganizationCreateWithoutUsersInput, OrganizationUncheckedCreateWithoutUsersInput>
    connectOrCreate?: OrganizationCreateOrConnectWithoutUsersInput
    upsert?: OrganizationUpsertWithoutUsersInput
    connect?: OrganizationWhereUniqueInput
    update?: XOR<XOR<OrganizationUpdateToOneWithWhereWithoutUsersInput, OrganizationUpdateWithoutUsersInput>, OrganizationUncheckedUpdateWithoutUsersInput>
  }

  export type ClearanceRequestUpdateManyWithoutStudentNestedInput = {
    create?: XOR<ClearanceRequestCreateWithoutStudentInput, ClearanceRequestUncheckedCreateWithoutStudentInput> | ClearanceRequestCreateWithoutStudentInput[] | ClearanceRequestUncheckedCreateWithoutStudentInput[]
    connectOrCreate?: ClearanceRequestCreateOrConnectWithoutStudentInput | ClearanceRequestCreateOrConnectWithoutStudentInput[]
    upsert?: ClearanceRequestUpsertWithWhereUniqueWithoutStudentInput | ClearanceRequestUpsertWithWhereUniqueWithoutStudentInput[]
    createMany?: ClearanceRequestCreateManyStudentInputEnvelope
    set?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
    disconnect?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
    delete?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
    connect?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
    update?: ClearanceRequestUpdateWithWhereUniqueWithoutStudentInput | ClearanceRequestUpdateWithWhereUniqueWithoutStudentInput[]
    updateMany?: ClearanceRequestUpdateManyWithWhereWithoutStudentInput | ClearanceRequestUpdateManyWithWhereWithoutStudentInput[]
    deleteMany?: ClearanceRequestScalarWhereInput | ClearanceRequestScalarWhereInput[]
  }

  export type ClearanceStepUpdateManyWithoutClearedByNestedInput = {
    create?: XOR<ClearanceStepCreateWithoutClearedByInput, ClearanceStepUncheckedCreateWithoutClearedByInput> | ClearanceStepCreateWithoutClearedByInput[] | ClearanceStepUncheckedCreateWithoutClearedByInput[]
    connectOrCreate?: ClearanceStepCreateOrConnectWithoutClearedByInput | ClearanceStepCreateOrConnectWithoutClearedByInput[]
    upsert?: ClearanceStepUpsertWithWhereUniqueWithoutClearedByInput | ClearanceStepUpsertWithWhereUniqueWithoutClearedByInput[]
    createMany?: ClearanceStepCreateManyClearedByInputEnvelope
    set?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
    disconnect?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
    delete?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
    connect?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
    update?: ClearanceStepUpdateWithWhereUniqueWithoutClearedByInput | ClearanceStepUpdateWithWhereUniqueWithoutClearedByInput[]
    updateMany?: ClearanceStepUpdateManyWithWhereWithoutClearedByInput | ClearanceStepUpdateManyWithWhereWithoutClearedByInput[]
    deleteMany?: ClearanceStepScalarWhereInput | ClearanceStepScalarWhereInput[]
  }

  export type ClearanceRequestUncheckedUpdateManyWithoutStudentNestedInput = {
    create?: XOR<ClearanceRequestCreateWithoutStudentInput, ClearanceRequestUncheckedCreateWithoutStudentInput> | ClearanceRequestCreateWithoutStudentInput[] | ClearanceRequestUncheckedCreateWithoutStudentInput[]
    connectOrCreate?: ClearanceRequestCreateOrConnectWithoutStudentInput | ClearanceRequestCreateOrConnectWithoutStudentInput[]
    upsert?: ClearanceRequestUpsertWithWhereUniqueWithoutStudentInput | ClearanceRequestUpsertWithWhereUniqueWithoutStudentInput[]
    createMany?: ClearanceRequestCreateManyStudentInputEnvelope
    set?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
    disconnect?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
    delete?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
    connect?: ClearanceRequestWhereUniqueInput | ClearanceRequestWhereUniqueInput[]
    update?: ClearanceRequestUpdateWithWhereUniqueWithoutStudentInput | ClearanceRequestUpdateWithWhereUniqueWithoutStudentInput[]
    updateMany?: ClearanceRequestUpdateManyWithWhereWithoutStudentInput | ClearanceRequestUpdateManyWithWhereWithoutStudentInput[]
    deleteMany?: ClearanceRequestScalarWhereInput | ClearanceRequestScalarWhereInput[]
  }

  export type ClearanceStepUncheckedUpdateManyWithoutClearedByNestedInput = {
    create?: XOR<ClearanceStepCreateWithoutClearedByInput, ClearanceStepUncheckedCreateWithoutClearedByInput> | ClearanceStepCreateWithoutClearedByInput[] | ClearanceStepUncheckedCreateWithoutClearedByInput[]
    connectOrCreate?: ClearanceStepCreateOrConnectWithoutClearedByInput | ClearanceStepCreateOrConnectWithoutClearedByInput[]
    upsert?: ClearanceStepUpsertWithWhereUniqueWithoutClearedByInput | ClearanceStepUpsertWithWhereUniqueWithoutClearedByInput[]
    createMany?: ClearanceStepCreateManyClearedByInputEnvelope
    set?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
    disconnect?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
    delete?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
    connect?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
    update?: ClearanceStepUpdateWithWhereUniqueWithoutClearedByInput | ClearanceStepUpdateWithWhereUniqueWithoutClearedByInput[]
    updateMany?: ClearanceStepUpdateManyWithWhereWithoutClearedByInput | ClearanceStepUpdateManyWithWhereWithoutClearedByInput[]
    deleteMany?: ClearanceStepScalarWhereInput | ClearanceStepScalarWhereInput[]
  }

  export type OrganizationCreateNestedOneWithoutClearancesInput = {
    create?: XOR<OrganizationCreateWithoutClearancesInput, OrganizationUncheckedCreateWithoutClearancesInput>
    connectOrCreate?: OrganizationCreateOrConnectWithoutClearancesInput
    connect?: OrganizationWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutClearancesInput = {
    create?: XOR<UserCreateWithoutClearancesInput, UserUncheckedCreateWithoutClearancesInput>
    connectOrCreate?: UserCreateOrConnectWithoutClearancesInput
    connect?: UserWhereUniqueInput
  }

  export type ClearanceStepCreateNestedManyWithoutRequestInput = {
    create?: XOR<ClearanceStepCreateWithoutRequestInput, ClearanceStepUncheckedCreateWithoutRequestInput> | ClearanceStepCreateWithoutRequestInput[] | ClearanceStepUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: ClearanceStepCreateOrConnectWithoutRequestInput | ClearanceStepCreateOrConnectWithoutRequestInput[]
    createMany?: ClearanceStepCreateManyRequestInputEnvelope
    connect?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
  }

  export type TransactionCreateNestedManyWithoutRequestInput = {
    create?: XOR<TransactionCreateWithoutRequestInput, TransactionUncheckedCreateWithoutRequestInput> | TransactionCreateWithoutRequestInput[] | TransactionUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: TransactionCreateOrConnectWithoutRequestInput | TransactionCreateOrConnectWithoutRequestInput[]
    createMany?: TransactionCreateManyRequestInputEnvelope
    connect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
  }

  export type ClearanceStepUncheckedCreateNestedManyWithoutRequestInput = {
    create?: XOR<ClearanceStepCreateWithoutRequestInput, ClearanceStepUncheckedCreateWithoutRequestInput> | ClearanceStepCreateWithoutRequestInput[] | ClearanceStepUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: ClearanceStepCreateOrConnectWithoutRequestInput | ClearanceStepCreateOrConnectWithoutRequestInput[]
    createMany?: ClearanceStepCreateManyRequestInputEnvelope
    connect?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
  }

  export type TransactionUncheckedCreateNestedManyWithoutRequestInput = {
    create?: XOR<TransactionCreateWithoutRequestInput, TransactionUncheckedCreateWithoutRequestInput> | TransactionCreateWithoutRequestInput[] | TransactionUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: TransactionCreateOrConnectWithoutRequestInput | TransactionCreateOrConnectWithoutRequestInput[]
    createMany?: TransactionCreateManyRequestInputEnvelope
    connect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
  }

  export type EnumRequestStatusFieldUpdateOperationsInput = {
    set?: $Enums.RequestStatus
  }

  export type OrganizationUpdateOneRequiredWithoutClearancesNestedInput = {
    create?: XOR<OrganizationCreateWithoutClearancesInput, OrganizationUncheckedCreateWithoutClearancesInput>
    connectOrCreate?: OrganizationCreateOrConnectWithoutClearancesInput
    upsert?: OrganizationUpsertWithoutClearancesInput
    connect?: OrganizationWhereUniqueInput
    update?: XOR<XOR<OrganizationUpdateToOneWithWhereWithoutClearancesInput, OrganizationUpdateWithoutClearancesInput>, OrganizationUncheckedUpdateWithoutClearancesInput>
  }

  export type UserUpdateOneRequiredWithoutClearancesNestedInput = {
    create?: XOR<UserCreateWithoutClearancesInput, UserUncheckedCreateWithoutClearancesInput>
    connectOrCreate?: UserCreateOrConnectWithoutClearancesInput
    upsert?: UserUpsertWithoutClearancesInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutClearancesInput, UserUpdateWithoutClearancesInput>, UserUncheckedUpdateWithoutClearancesInput>
  }

  export type ClearanceStepUpdateManyWithoutRequestNestedInput = {
    create?: XOR<ClearanceStepCreateWithoutRequestInput, ClearanceStepUncheckedCreateWithoutRequestInput> | ClearanceStepCreateWithoutRequestInput[] | ClearanceStepUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: ClearanceStepCreateOrConnectWithoutRequestInput | ClearanceStepCreateOrConnectWithoutRequestInput[]
    upsert?: ClearanceStepUpsertWithWhereUniqueWithoutRequestInput | ClearanceStepUpsertWithWhereUniqueWithoutRequestInput[]
    createMany?: ClearanceStepCreateManyRequestInputEnvelope
    set?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
    disconnect?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
    delete?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
    connect?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
    update?: ClearanceStepUpdateWithWhereUniqueWithoutRequestInput | ClearanceStepUpdateWithWhereUniqueWithoutRequestInput[]
    updateMany?: ClearanceStepUpdateManyWithWhereWithoutRequestInput | ClearanceStepUpdateManyWithWhereWithoutRequestInput[]
    deleteMany?: ClearanceStepScalarWhereInput | ClearanceStepScalarWhereInput[]
  }

  export type TransactionUpdateManyWithoutRequestNestedInput = {
    create?: XOR<TransactionCreateWithoutRequestInput, TransactionUncheckedCreateWithoutRequestInput> | TransactionCreateWithoutRequestInput[] | TransactionUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: TransactionCreateOrConnectWithoutRequestInput | TransactionCreateOrConnectWithoutRequestInput[]
    upsert?: TransactionUpsertWithWhereUniqueWithoutRequestInput | TransactionUpsertWithWhereUniqueWithoutRequestInput[]
    createMany?: TransactionCreateManyRequestInputEnvelope
    set?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    disconnect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    delete?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    connect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    update?: TransactionUpdateWithWhereUniqueWithoutRequestInput | TransactionUpdateWithWhereUniqueWithoutRequestInput[]
    updateMany?: TransactionUpdateManyWithWhereWithoutRequestInput | TransactionUpdateManyWithWhereWithoutRequestInput[]
    deleteMany?: TransactionScalarWhereInput | TransactionScalarWhereInput[]
  }

  export type ClearanceStepUncheckedUpdateManyWithoutRequestNestedInput = {
    create?: XOR<ClearanceStepCreateWithoutRequestInput, ClearanceStepUncheckedCreateWithoutRequestInput> | ClearanceStepCreateWithoutRequestInput[] | ClearanceStepUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: ClearanceStepCreateOrConnectWithoutRequestInput | ClearanceStepCreateOrConnectWithoutRequestInput[]
    upsert?: ClearanceStepUpsertWithWhereUniqueWithoutRequestInput | ClearanceStepUpsertWithWhereUniqueWithoutRequestInput[]
    createMany?: ClearanceStepCreateManyRequestInputEnvelope
    set?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
    disconnect?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
    delete?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
    connect?: ClearanceStepWhereUniqueInput | ClearanceStepWhereUniqueInput[]
    update?: ClearanceStepUpdateWithWhereUniqueWithoutRequestInput | ClearanceStepUpdateWithWhereUniqueWithoutRequestInput[]
    updateMany?: ClearanceStepUpdateManyWithWhereWithoutRequestInput | ClearanceStepUpdateManyWithWhereWithoutRequestInput[]
    deleteMany?: ClearanceStepScalarWhereInput | ClearanceStepScalarWhereInput[]
  }

  export type TransactionUncheckedUpdateManyWithoutRequestNestedInput = {
    create?: XOR<TransactionCreateWithoutRequestInput, TransactionUncheckedCreateWithoutRequestInput> | TransactionCreateWithoutRequestInput[] | TransactionUncheckedCreateWithoutRequestInput[]
    connectOrCreate?: TransactionCreateOrConnectWithoutRequestInput | TransactionCreateOrConnectWithoutRequestInput[]
    upsert?: TransactionUpsertWithWhereUniqueWithoutRequestInput | TransactionUpsertWithWhereUniqueWithoutRequestInput[]
    createMany?: TransactionCreateManyRequestInputEnvelope
    set?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    disconnect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    delete?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    connect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    update?: TransactionUpdateWithWhereUniqueWithoutRequestInput | TransactionUpdateWithWhereUniqueWithoutRequestInput[]
    updateMany?: TransactionUpdateManyWithWhereWithoutRequestInput | TransactionUpdateManyWithWhereWithoutRequestInput[]
    deleteMany?: TransactionScalarWhereInput | TransactionScalarWhereInput[]
  }

  export type ClearanceRequestCreateNestedOneWithoutStepsInput = {
    create?: XOR<ClearanceRequestCreateWithoutStepsInput, ClearanceRequestUncheckedCreateWithoutStepsInput>
    connectOrCreate?: ClearanceRequestCreateOrConnectWithoutStepsInput
    connect?: ClearanceRequestWhereUniqueInput
  }

  export type UserCreateNestedOneWithoutStepsApprovedInput = {
    create?: XOR<UserCreateWithoutStepsApprovedInput, UserUncheckedCreateWithoutStepsApprovedInput>
    connectOrCreate?: UserCreateOrConnectWithoutStepsApprovedInput
    connect?: UserWhereUniqueInput
  }

  export type EnumStepStatusFieldUpdateOperationsInput = {
    set?: $Enums.StepStatus
  }

  export type ClearanceRequestUpdateOneRequiredWithoutStepsNestedInput = {
    create?: XOR<ClearanceRequestCreateWithoutStepsInput, ClearanceRequestUncheckedCreateWithoutStepsInput>
    connectOrCreate?: ClearanceRequestCreateOrConnectWithoutStepsInput
    upsert?: ClearanceRequestUpsertWithoutStepsInput
    connect?: ClearanceRequestWhereUniqueInput
    update?: XOR<XOR<ClearanceRequestUpdateToOneWithWhereWithoutStepsInput, ClearanceRequestUpdateWithoutStepsInput>, ClearanceRequestUncheckedUpdateWithoutStepsInput>
  }

  export type UserUpdateOneWithoutStepsApprovedNestedInput = {
    create?: XOR<UserCreateWithoutStepsApprovedInput, UserUncheckedCreateWithoutStepsApprovedInput>
    connectOrCreate?: UserCreateOrConnectWithoutStepsApprovedInput
    upsert?: UserUpsertWithoutStepsApprovedInput
    disconnect?: UserWhereInput | boolean
    delete?: UserWhereInput | boolean
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutStepsApprovedInput, UserUpdateWithoutStepsApprovedInput>, UserUncheckedUpdateWithoutStepsApprovedInput>
  }

  export type ClearanceRequestCreateNestedOneWithoutTransactionsInput = {
    create?: XOR<ClearanceRequestCreateWithoutTransactionsInput, ClearanceRequestUncheckedCreateWithoutTransactionsInput>
    connectOrCreate?: ClearanceRequestCreateOrConnectWithoutTransactionsInput
    connect?: ClearanceRequestWhereUniqueInput
  }

  export type DecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type ClearanceRequestUpdateOneRequiredWithoutTransactionsNestedInput = {
    create?: XOR<ClearanceRequestCreateWithoutTransactionsInput, ClearanceRequestUncheckedCreateWithoutTransactionsInput>
    connectOrCreate?: ClearanceRequestCreateOrConnectWithoutTransactionsInput
    upsert?: ClearanceRequestUpsertWithoutTransactionsInput
    connect?: ClearanceRequestWhereUniqueInput
    update?: XOR<XOR<ClearanceRequestUpdateToOneWithWhereWithoutTransactionsInput, ClearanceRequestUpdateWithoutTransactionsInput>, ClearanceRequestUncheckedUpdateWithoutTransactionsInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedEnumRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.Role | EnumRoleFieldRefInput<$PrismaModel>
    in?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleFilter<$PrismaModel> | $Enums.Role
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedEnumRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.Role | EnumRoleFieldRefInput<$PrismaModel>
    in?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.Role[] | ListEnumRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumRoleWithAggregatesFilter<$PrismaModel> | $Enums.Role
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRoleFilter<$PrismaModel>
    _max?: NestedEnumRoleFilter<$PrismaModel>
  }

  export type NestedEnumRequestStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.RequestStatus | EnumRequestStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RequestStatus[] | ListEnumRequestStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RequestStatus[] | ListEnumRequestStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRequestStatusFilter<$PrismaModel> | $Enums.RequestStatus
  }

  export type NestedEnumRequestStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RequestStatus | EnumRequestStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RequestStatus[] | ListEnumRequestStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RequestStatus[] | ListEnumRequestStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRequestStatusWithAggregatesFilter<$PrismaModel> | $Enums.RequestStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRequestStatusFilter<$PrismaModel>
    _max?: NestedEnumRequestStatusFilter<$PrismaModel>
  }

  export type NestedEnumStepStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.StepStatus | EnumStepStatusFieldRefInput<$PrismaModel>
    in?: $Enums.StepStatus[] | ListEnumStepStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.StepStatus[] | ListEnumStepStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumStepStatusFilter<$PrismaModel> | $Enums.StepStatus
  }

  export type NestedEnumStepStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.StepStatus | EnumStepStatusFieldRefInput<$PrismaModel>
    in?: $Enums.StepStatus[] | ListEnumStepStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.StepStatus[] | ListEnumStepStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumStepStatusWithAggregatesFilter<$PrismaModel> | $Enums.StepStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumStepStatusFilter<$PrismaModel>
    _max?: NestedEnumStepStatusFilter<$PrismaModel>
  }

  export type NestedDecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedDecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type UserCreateWithoutOrganizationInput = {
    id?: string
    email: string
    name: string
    studentId?: string | null
    role?: $Enums.Role
    createdAt?: Date | string
    updatedAt?: Date | string
    clearances?: ClearanceRequestCreateNestedManyWithoutStudentInput
    stepsApproved?: ClearanceStepCreateNestedManyWithoutClearedByInput
  }

  export type UserUncheckedCreateWithoutOrganizationInput = {
    id?: string
    email: string
    name: string
    studentId?: string | null
    role?: $Enums.Role
    createdAt?: Date | string
    updatedAt?: Date | string
    clearances?: ClearanceRequestUncheckedCreateNestedManyWithoutStudentInput
    stepsApproved?: ClearanceStepUncheckedCreateNestedManyWithoutClearedByInput
  }

  export type UserCreateOrConnectWithoutOrganizationInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutOrganizationInput, UserUncheckedCreateWithoutOrganizationInput>
  }

  export type UserCreateManyOrganizationInputEnvelope = {
    data: UserCreateManyOrganizationInput | UserCreateManyOrganizationInput[]
    skipDuplicates?: boolean
  }

  export type ClearanceRequestCreateWithoutOrganizationInput = {
    id?: string
    academicYear: string
    semester: string
    status?: $Enums.RequestStatus
    qrPayload?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    student: UserCreateNestedOneWithoutClearancesInput
    steps?: ClearanceStepCreateNestedManyWithoutRequestInput
    transactions?: TransactionCreateNestedManyWithoutRequestInput
  }

  export type ClearanceRequestUncheckedCreateWithoutOrganizationInput = {
    id?: string
    academicYear: string
    semester: string
    status?: $Enums.RequestStatus
    qrPayload?: string | null
    studentId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    steps?: ClearanceStepUncheckedCreateNestedManyWithoutRequestInput
    transactions?: TransactionUncheckedCreateNestedManyWithoutRequestInput
  }

  export type ClearanceRequestCreateOrConnectWithoutOrganizationInput = {
    where: ClearanceRequestWhereUniqueInput
    create: XOR<ClearanceRequestCreateWithoutOrganizationInput, ClearanceRequestUncheckedCreateWithoutOrganizationInput>
  }

  export type ClearanceRequestCreateManyOrganizationInputEnvelope = {
    data: ClearanceRequestCreateManyOrganizationInput | ClearanceRequestCreateManyOrganizationInput[]
    skipDuplicates?: boolean
  }

  export type UserUpsertWithWhereUniqueWithoutOrganizationInput = {
    where: UserWhereUniqueInput
    update: XOR<UserUpdateWithoutOrganizationInput, UserUncheckedUpdateWithoutOrganizationInput>
    create: XOR<UserCreateWithoutOrganizationInput, UserUncheckedCreateWithoutOrganizationInput>
  }

  export type UserUpdateWithWhereUniqueWithoutOrganizationInput = {
    where: UserWhereUniqueInput
    data: XOR<UserUpdateWithoutOrganizationInput, UserUncheckedUpdateWithoutOrganizationInput>
  }

  export type UserUpdateManyWithWhereWithoutOrganizationInput = {
    where: UserScalarWhereInput
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyWithoutOrganizationInput>
  }

  export type UserScalarWhereInput = {
    AND?: UserScalarWhereInput | UserScalarWhereInput[]
    OR?: UserScalarWhereInput[]
    NOT?: UserScalarWhereInput | UserScalarWhereInput[]
    id?: StringFilter<"User"> | string
    email?: StringFilter<"User"> | string
    name?: StringFilter<"User"> | string
    studentId?: StringNullableFilter<"User"> | string | null
    role?: EnumRoleFilter<"User"> | $Enums.Role
    organizationId?: StringFilter<"User"> | string
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
  }

  export type ClearanceRequestUpsertWithWhereUniqueWithoutOrganizationInput = {
    where: ClearanceRequestWhereUniqueInput
    update: XOR<ClearanceRequestUpdateWithoutOrganizationInput, ClearanceRequestUncheckedUpdateWithoutOrganizationInput>
    create: XOR<ClearanceRequestCreateWithoutOrganizationInput, ClearanceRequestUncheckedCreateWithoutOrganizationInput>
  }

  export type ClearanceRequestUpdateWithWhereUniqueWithoutOrganizationInput = {
    where: ClearanceRequestWhereUniqueInput
    data: XOR<ClearanceRequestUpdateWithoutOrganizationInput, ClearanceRequestUncheckedUpdateWithoutOrganizationInput>
  }

  export type ClearanceRequestUpdateManyWithWhereWithoutOrganizationInput = {
    where: ClearanceRequestScalarWhereInput
    data: XOR<ClearanceRequestUpdateManyMutationInput, ClearanceRequestUncheckedUpdateManyWithoutOrganizationInput>
  }

  export type ClearanceRequestScalarWhereInput = {
    AND?: ClearanceRequestScalarWhereInput | ClearanceRequestScalarWhereInput[]
    OR?: ClearanceRequestScalarWhereInput[]
    NOT?: ClearanceRequestScalarWhereInput | ClearanceRequestScalarWhereInput[]
    id?: StringFilter<"ClearanceRequest"> | string
    academicYear?: StringFilter<"ClearanceRequest"> | string
    semester?: StringFilter<"ClearanceRequest"> | string
    status?: EnumRequestStatusFilter<"ClearanceRequest"> | $Enums.RequestStatus
    qrPayload?: StringNullableFilter<"ClearanceRequest"> | string | null
    organizationId?: StringFilter<"ClearanceRequest"> | string
    studentId?: StringFilter<"ClearanceRequest"> | string
    createdAt?: DateTimeFilter<"ClearanceRequest"> | Date | string
    updatedAt?: DateTimeFilter<"ClearanceRequest"> | Date | string
  }

  export type OrganizationCreateWithoutUsersInput = {
    id?: string
    name: string
    subdomain: string
    createdAt?: Date | string
    clearances?: ClearanceRequestCreateNestedManyWithoutOrganizationInput
  }

  export type OrganizationUncheckedCreateWithoutUsersInput = {
    id?: string
    name: string
    subdomain: string
    createdAt?: Date | string
    clearances?: ClearanceRequestUncheckedCreateNestedManyWithoutOrganizationInput
  }

  export type OrganizationCreateOrConnectWithoutUsersInput = {
    where: OrganizationWhereUniqueInput
    create: XOR<OrganizationCreateWithoutUsersInput, OrganizationUncheckedCreateWithoutUsersInput>
  }

  export type ClearanceRequestCreateWithoutStudentInput = {
    id?: string
    academicYear: string
    semester: string
    status?: $Enums.RequestStatus
    qrPayload?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    organization: OrganizationCreateNestedOneWithoutClearancesInput
    steps?: ClearanceStepCreateNestedManyWithoutRequestInput
    transactions?: TransactionCreateNestedManyWithoutRequestInput
  }

  export type ClearanceRequestUncheckedCreateWithoutStudentInput = {
    id?: string
    academicYear: string
    semester: string
    status?: $Enums.RequestStatus
    qrPayload?: string | null
    organizationId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    steps?: ClearanceStepUncheckedCreateNestedManyWithoutRequestInput
    transactions?: TransactionUncheckedCreateNestedManyWithoutRequestInput
  }

  export type ClearanceRequestCreateOrConnectWithoutStudentInput = {
    where: ClearanceRequestWhereUniqueInput
    create: XOR<ClearanceRequestCreateWithoutStudentInput, ClearanceRequestUncheckedCreateWithoutStudentInput>
  }

  export type ClearanceRequestCreateManyStudentInputEnvelope = {
    data: ClearanceRequestCreateManyStudentInput | ClearanceRequestCreateManyStudentInput[]
    skipDuplicates?: boolean
  }

  export type ClearanceStepCreateWithoutClearedByInput = {
    id?: string
    nodeName: string
    status?: $Enums.StepStatus
    remarks?: string | null
    updatedAt?: Date | string
    request: ClearanceRequestCreateNestedOneWithoutStepsInput
  }

  export type ClearanceStepUncheckedCreateWithoutClearedByInput = {
    id?: string
    nodeName: string
    status?: $Enums.StepStatus
    remarks?: string | null
    requestId: string
    updatedAt?: Date | string
  }

  export type ClearanceStepCreateOrConnectWithoutClearedByInput = {
    where: ClearanceStepWhereUniqueInput
    create: XOR<ClearanceStepCreateWithoutClearedByInput, ClearanceStepUncheckedCreateWithoutClearedByInput>
  }

  export type ClearanceStepCreateManyClearedByInputEnvelope = {
    data: ClearanceStepCreateManyClearedByInput | ClearanceStepCreateManyClearedByInput[]
    skipDuplicates?: boolean
  }

  export type OrganizationUpsertWithoutUsersInput = {
    update: XOR<OrganizationUpdateWithoutUsersInput, OrganizationUncheckedUpdateWithoutUsersInput>
    create: XOR<OrganizationCreateWithoutUsersInput, OrganizationUncheckedCreateWithoutUsersInput>
    where?: OrganizationWhereInput
  }

  export type OrganizationUpdateToOneWithWhereWithoutUsersInput = {
    where?: OrganizationWhereInput
    data: XOR<OrganizationUpdateWithoutUsersInput, OrganizationUncheckedUpdateWithoutUsersInput>
  }

  export type OrganizationUpdateWithoutUsersInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    subdomain?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    clearances?: ClearanceRequestUpdateManyWithoutOrganizationNestedInput
  }

  export type OrganizationUncheckedUpdateWithoutUsersInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    subdomain?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    clearances?: ClearanceRequestUncheckedUpdateManyWithoutOrganizationNestedInput
  }

  export type ClearanceRequestUpsertWithWhereUniqueWithoutStudentInput = {
    where: ClearanceRequestWhereUniqueInput
    update: XOR<ClearanceRequestUpdateWithoutStudentInput, ClearanceRequestUncheckedUpdateWithoutStudentInput>
    create: XOR<ClearanceRequestCreateWithoutStudentInput, ClearanceRequestUncheckedCreateWithoutStudentInput>
  }

  export type ClearanceRequestUpdateWithWhereUniqueWithoutStudentInput = {
    where: ClearanceRequestWhereUniqueInput
    data: XOR<ClearanceRequestUpdateWithoutStudentInput, ClearanceRequestUncheckedUpdateWithoutStudentInput>
  }

  export type ClearanceRequestUpdateManyWithWhereWithoutStudentInput = {
    where: ClearanceRequestScalarWhereInput
    data: XOR<ClearanceRequestUpdateManyMutationInput, ClearanceRequestUncheckedUpdateManyWithoutStudentInput>
  }

  export type ClearanceStepUpsertWithWhereUniqueWithoutClearedByInput = {
    where: ClearanceStepWhereUniqueInput
    update: XOR<ClearanceStepUpdateWithoutClearedByInput, ClearanceStepUncheckedUpdateWithoutClearedByInput>
    create: XOR<ClearanceStepCreateWithoutClearedByInput, ClearanceStepUncheckedCreateWithoutClearedByInput>
  }

  export type ClearanceStepUpdateWithWhereUniqueWithoutClearedByInput = {
    where: ClearanceStepWhereUniqueInput
    data: XOR<ClearanceStepUpdateWithoutClearedByInput, ClearanceStepUncheckedUpdateWithoutClearedByInput>
  }

  export type ClearanceStepUpdateManyWithWhereWithoutClearedByInput = {
    where: ClearanceStepScalarWhereInput
    data: XOR<ClearanceStepUpdateManyMutationInput, ClearanceStepUncheckedUpdateManyWithoutClearedByInput>
  }

  export type ClearanceStepScalarWhereInput = {
    AND?: ClearanceStepScalarWhereInput | ClearanceStepScalarWhereInput[]
    OR?: ClearanceStepScalarWhereInput[]
    NOT?: ClearanceStepScalarWhereInput | ClearanceStepScalarWhereInput[]
    id?: StringFilter<"ClearanceStep"> | string
    nodeName?: StringFilter<"ClearanceStep"> | string
    status?: EnumStepStatusFilter<"ClearanceStep"> | $Enums.StepStatus
    remarks?: StringNullableFilter<"ClearanceStep"> | string | null
    requestId?: StringFilter<"ClearanceStep"> | string
    clearedById?: StringNullableFilter<"ClearanceStep"> | string | null
    updatedAt?: DateTimeFilter<"ClearanceStep"> | Date | string
  }

  export type OrganizationCreateWithoutClearancesInput = {
    id?: string
    name: string
    subdomain: string
    createdAt?: Date | string
    users?: UserCreateNestedManyWithoutOrganizationInput
  }

  export type OrganizationUncheckedCreateWithoutClearancesInput = {
    id?: string
    name: string
    subdomain: string
    createdAt?: Date | string
    users?: UserUncheckedCreateNestedManyWithoutOrganizationInput
  }

  export type OrganizationCreateOrConnectWithoutClearancesInput = {
    where: OrganizationWhereUniqueInput
    create: XOR<OrganizationCreateWithoutClearancesInput, OrganizationUncheckedCreateWithoutClearancesInput>
  }

  export type UserCreateWithoutClearancesInput = {
    id?: string
    email: string
    name: string
    studentId?: string | null
    role?: $Enums.Role
    createdAt?: Date | string
    updatedAt?: Date | string
    organization: OrganizationCreateNestedOneWithoutUsersInput
    stepsApproved?: ClearanceStepCreateNestedManyWithoutClearedByInput
  }

  export type UserUncheckedCreateWithoutClearancesInput = {
    id?: string
    email: string
    name: string
    studentId?: string | null
    role?: $Enums.Role
    organizationId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    stepsApproved?: ClearanceStepUncheckedCreateNestedManyWithoutClearedByInput
  }

  export type UserCreateOrConnectWithoutClearancesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutClearancesInput, UserUncheckedCreateWithoutClearancesInput>
  }

  export type ClearanceStepCreateWithoutRequestInput = {
    id?: string
    nodeName: string
    status?: $Enums.StepStatus
    remarks?: string | null
    updatedAt?: Date | string
    clearedBy?: UserCreateNestedOneWithoutStepsApprovedInput
  }

  export type ClearanceStepUncheckedCreateWithoutRequestInput = {
    id?: string
    nodeName: string
    status?: $Enums.StepStatus
    remarks?: string | null
    clearedById?: string | null
    updatedAt?: Date | string
  }

  export type ClearanceStepCreateOrConnectWithoutRequestInput = {
    where: ClearanceStepWhereUniqueInput
    create: XOR<ClearanceStepCreateWithoutRequestInput, ClearanceStepUncheckedCreateWithoutRequestInput>
  }

  export type ClearanceStepCreateManyRequestInputEnvelope = {
    data: ClearanceStepCreateManyRequestInput | ClearanceStepCreateManyRequestInput[]
    skipDuplicates?: boolean
  }

  export type TransactionCreateWithoutRequestInput = {
    id?: string
    amount: Decimal | DecimalJsLike | number | string
    referenceNo: string
    proofUrl?: string | null
    verified?: boolean
    createdAt?: Date | string
  }

  export type TransactionUncheckedCreateWithoutRequestInput = {
    id?: string
    amount: Decimal | DecimalJsLike | number | string
    referenceNo: string
    proofUrl?: string | null
    verified?: boolean
    createdAt?: Date | string
  }

  export type TransactionCreateOrConnectWithoutRequestInput = {
    where: TransactionWhereUniqueInput
    create: XOR<TransactionCreateWithoutRequestInput, TransactionUncheckedCreateWithoutRequestInput>
  }

  export type TransactionCreateManyRequestInputEnvelope = {
    data: TransactionCreateManyRequestInput | TransactionCreateManyRequestInput[]
    skipDuplicates?: boolean
  }

  export type OrganizationUpsertWithoutClearancesInput = {
    update: XOR<OrganizationUpdateWithoutClearancesInput, OrganizationUncheckedUpdateWithoutClearancesInput>
    create: XOR<OrganizationCreateWithoutClearancesInput, OrganizationUncheckedCreateWithoutClearancesInput>
    where?: OrganizationWhereInput
  }

  export type OrganizationUpdateToOneWithWhereWithoutClearancesInput = {
    where?: OrganizationWhereInput
    data: XOR<OrganizationUpdateWithoutClearancesInput, OrganizationUncheckedUpdateWithoutClearancesInput>
  }

  export type OrganizationUpdateWithoutClearancesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    subdomain?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    users?: UserUpdateManyWithoutOrganizationNestedInput
  }

  export type OrganizationUncheckedUpdateWithoutClearancesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    subdomain?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    users?: UserUncheckedUpdateManyWithoutOrganizationNestedInput
  }

  export type UserUpsertWithoutClearancesInput = {
    update: XOR<UserUpdateWithoutClearancesInput, UserUncheckedUpdateWithoutClearancesInput>
    create: XOR<UserCreateWithoutClearancesInput, UserUncheckedCreateWithoutClearancesInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutClearancesInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutClearancesInput, UserUncheckedUpdateWithoutClearancesInput>
  }

  export type UserUpdateWithoutClearancesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    studentId?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organization?: OrganizationUpdateOneRequiredWithoutUsersNestedInput
    stepsApproved?: ClearanceStepUpdateManyWithoutClearedByNestedInput
  }

  export type UserUncheckedUpdateWithoutClearancesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    studentId?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    organizationId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    stepsApproved?: ClearanceStepUncheckedUpdateManyWithoutClearedByNestedInput
  }

  export type ClearanceStepUpsertWithWhereUniqueWithoutRequestInput = {
    where: ClearanceStepWhereUniqueInput
    update: XOR<ClearanceStepUpdateWithoutRequestInput, ClearanceStepUncheckedUpdateWithoutRequestInput>
    create: XOR<ClearanceStepCreateWithoutRequestInput, ClearanceStepUncheckedCreateWithoutRequestInput>
  }

  export type ClearanceStepUpdateWithWhereUniqueWithoutRequestInput = {
    where: ClearanceStepWhereUniqueInput
    data: XOR<ClearanceStepUpdateWithoutRequestInput, ClearanceStepUncheckedUpdateWithoutRequestInput>
  }

  export type ClearanceStepUpdateManyWithWhereWithoutRequestInput = {
    where: ClearanceStepScalarWhereInput
    data: XOR<ClearanceStepUpdateManyMutationInput, ClearanceStepUncheckedUpdateManyWithoutRequestInput>
  }

  export type TransactionUpsertWithWhereUniqueWithoutRequestInput = {
    where: TransactionWhereUniqueInput
    update: XOR<TransactionUpdateWithoutRequestInput, TransactionUncheckedUpdateWithoutRequestInput>
    create: XOR<TransactionCreateWithoutRequestInput, TransactionUncheckedCreateWithoutRequestInput>
  }

  export type TransactionUpdateWithWhereUniqueWithoutRequestInput = {
    where: TransactionWhereUniqueInput
    data: XOR<TransactionUpdateWithoutRequestInput, TransactionUncheckedUpdateWithoutRequestInput>
  }

  export type TransactionUpdateManyWithWhereWithoutRequestInput = {
    where: TransactionScalarWhereInput
    data: XOR<TransactionUpdateManyMutationInput, TransactionUncheckedUpdateManyWithoutRequestInput>
  }

  export type TransactionScalarWhereInput = {
    AND?: TransactionScalarWhereInput | TransactionScalarWhereInput[]
    OR?: TransactionScalarWhereInput[]
    NOT?: TransactionScalarWhereInput | TransactionScalarWhereInput[]
    id?: StringFilter<"Transaction"> | string
    amount?: DecimalFilter<"Transaction"> | Decimal | DecimalJsLike | number | string
    referenceNo?: StringFilter<"Transaction"> | string
    proofUrl?: StringNullableFilter<"Transaction"> | string | null
    verified?: BoolFilter<"Transaction"> | boolean
    requestId?: StringFilter<"Transaction"> | string
    createdAt?: DateTimeFilter<"Transaction"> | Date | string
  }

  export type ClearanceRequestCreateWithoutStepsInput = {
    id?: string
    academicYear: string
    semester: string
    status?: $Enums.RequestStatus
    qrPayload?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    organization: OrganizationCreateNestedOneWithoutClearancesInput
    student: UserCreateNestedOneWithoutClearancesInput
    transactions?: TransactionCreateNestedManyWithoutRequestInput
  }

  export type ClearanceRequestUncheckedCreateWithoutStepsInput = {
    id?: string
    academicYear: string
    semester: string
    status?: $Enums.RequestStatus
    qrPayload?: string | null
    organizationId: string
    studentId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    transactions?: TransactionUncheckedCreateNestedManyWithoutRequestInput
  }

  export type ClearanceRequestCreateOrConnectWithoutStepsInput = {
    where: ClearanceRequestWhereUniqueInput
    create: XOR<ClearanceRequestCreateWithoutStepsInput, ClearanceRequestUncheckedCreateWithoutStepsInput>
  }

  export type UserCreateWithoutStepsApprovedInput = {
    id?: string
    email: string
    name: string
    studentId?: string | null
    role?: $Enums.Role
    createdAt?: Date | string
    updatedAt?: Date | string
    organization: OrganizationCreateNestedOneWithoutUsersInput
    clearances?: ClearanceRequestCreateNestedManyWithoutStudentInput
  }

  export type UserUncheckedCreateWithoutStepsApprovedInput = {
    id?: string
    email: string
    name: string
    studentId?: string | null
    role?: $Enums.Role
    organizationId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    clearances?: ClearanceRequestUncheckedCreateNestedManyWithoutStudentInput
  }

  export type UserCreateOrConnectWithoutStepsApprovedInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutStepsApprovedInput, UserUncheckedCreateWithoutStepsApprovedInput>
  }

  export type ClearanceRequestUpsertWithoutStepsInput = {
    update: XOR<ClearanceRequestUpdateWithoutStepsInput, ClearanceRequestUncheckedUpdateWithoutStepsInput>
    create: XOR<ClearanceRequestCreateWithoutStepsInput, ClearanceRequestUncheckedCreateWithoutStepsInput>
    where?: ClearanceRequestWhereInput
  }

  export type ClearanceRequestUpdateToOneWithWhereWithoutStepsInput = {
    where?: ClearanceRequestWhereInput
    data: XOR<ClearanceRequestUpdateWithoutStepsInput, ClearanceRequestUncheckedUpdateWithoutStepsInput>
  }

  export type ClearanceRequestUpdateWithoutStepsInput = {
    id?: StringFieldUpdateOperationsInput | string
    academicYear?: StringFieldUpdateOperationsInput | string
    semester?: StringFieldUpdateOperationsInput | string
    status?: EnumRequestStatusFieldUpdateOperationsInput | $Enums.RequestStatus
    qrPayload?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organization?: OrganizationUpdateOneRequiredWithoutClearancesNestedInput
    student?: UserUpdateOneRequiredWithoutClearancesNestedInput
    transactions?: TransactionUpdateManyWithoutRequestNestedInput
  }

  export type ClearanceRequestUncheckedUpdateWithoutStepsInput = {
    id?: StringFieldUpdateOperationsInput | string
    academicYear?: StringFieldUpdateOperationsInput | string
    semester?: StringFieldUpdateOperationsInput | string
    status?: EnumRequestStatusFieldUpdateOperationsInput | $Enums.RequestStatus
    qrPayload?: NullableStringFieldUpdateOperationsInput | string | null
    organizationId?: StringFieldUpdateOperationsInput | string
    studentId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    transactions?: TransactionUncheckedUpdateManyWithoutRequestNestedInput
  }

  export type UserUpsertWithoutStepsApprovedInput = {
    update: XOR<UserUpdateWithoutStepsApprovedInput, UserUncheckedUpdateWithoutStepsApprovedInput>
    create: XOR<UserCreateWithoutStepsApprovedInput, UserUncheckedCreateWithoutStepsApprovedInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutStepsApprovedInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutStepsApprovedInput, UserUncheckedUpdateWithoutStepsApprovedInput>
  }

  export type UserUpdateWithoutStepsApprovedInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    studentId?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organization?: OrganizationUpdateOneRequiredWithoutUsersNestedInput
    clearances?: ClearanceRequestUpdateManyWithoutStudentNestedInput
  }

  export type UserUncheckedUpdateWithoutStepsApprovedInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    studentId?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    organizationId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    clearances?: ClearanceRequestUncheckedUpdateManyWithoutStudentNestedInput
  }

  export type ClearanceRequestCreateWithoutTransactionsInput = {
    id?: string
    academicYear: string
    semester: string
    status?: $Enums.RequestStatus
    qrPayload?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    organization: OrganizationCreateNestedOneWithoutClearancesInput
    student: UserCreateNestedOneWithoutClearancesInput
    steps?: ClearanceStepCreateNestedManyWithoutRequestInput
  }

  export type ClearanceRequestUncheckedCreateWithoutTransactionsInput = {
    id?: string
    academicYear: string
    semester: string
    status?: $Enums.RequestStatus
    qrPayload?: string | null
    organizationId: string
    studentId: string
    createdAt?: Date | string
    updatedAt?: Date | string
    steps?: ClearanceStepUncheckedCreateNestedManyWithoutRequestInput
  }

  export type ClearanceRequestCreateOrConnectWithoutTransactionsInput = {
    where: ClearanceRequestWhereUniqueInput
    create: XOR<ClearanceRequestCreateWithoutTransactionsInput, ClearanceRequestUncheckedCreateWithoutTransactionsInput>
  }

  export type ClearanceRequestUpsertWithoutTransactionsInput = {
    update: XOR<ClearanceRequestUpdateWithoutTransactionsInput, ClearanceRequestUncheckedUpdateWithoutTransactionsInput>
    create: XOR<ClearanceRequestCreateWithoutTransactionsInput, ClearanceRequestUncheckedCreateWithoutTransactionsInput>
    where?: ClearanceRequestWhereInput
  }

  export type ClearanceRequestUpdateToOneWithWhereWithoutTransactionsInput = {
    where?: ClearanceRequestWhereInput
    data: XOR<ClearanceRequestUpdateWithoutTransactionsInput, ClearanceRequestUncheckedUpdateWithoutTransactionsInput>
  }

  export type ClearanceRequestUpdateWithoutTransactionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    academicYear?: StringFieldUpdateOperationsInput | string
    semester?: StringFieldUpdateOperationsInput | string
    status?: EnumRequestStatusFieldUpdateOperationsInput | $Enums.RequestStatus
    qrPayload?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organization?: OrganizationUpdateOneRequiredWithoutClearancesNestedInput
    student?: UserUpdateOneRequiredWithoutClearancesNestedInput
    steps?: ClearanceStepUpdateManyWithoutRequestNestedInput
  }

  export type ClearanceRequestUncheckedUpdateWithoutTransactionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    academicYear?: StringFieldUpdateOperationsInput | string
    semester?: StringFieldUpdateOperationsInput | string
    status?: EnumRequestStatusFieldUpdateOperationsInput | $Enums.RequestStatus
    qrPayload?: NullableStringFieldUpdateOperationsInput | string | null
    organizationId?: StringFieldUpdateOperationsInput | string
    studentId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    steps?: ClearanceStepUncheckedUpdateManyWithoutRequestNestedInput
  }

  export type UserCreateManyOrganizationInput = {
    id?: string
    email: string
    name: string
    studentId?: string | null
    role?: $Enums.Role
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ClearanceRequestCreateManyOrganizationInput = {
    id?: string
    academicYear: string
    semester: string
    status?: $Enums.RequestStatus
    qrPayload?: string | null
    studentId: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    studentId?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    clearances?: ClearanceRequestUpdateManyWithoutStudentNestedInput
    stepsApproved?: ClearanceStepUpdateManyWithoutClearedByNestedInput
  }

  export type UserUncheckedUpdateWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    studentId?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    clearances?: ClearanceRequestUncheckedUpdateManyWithoutStudentNestedInput
    stepsApproved?: ClearanceStepUncheckedUpdateManyWithoutClearedByNestedInput
  }

  export type UserUncheckedUpdateManyWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    studentId?: NullableStringFieldUpdateOperationsInput | string | null
    role?: EnumRoleFieldUpdateOperationsInput | $Enums.Role
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClearanceRequestUpdateWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string
    academicYear?: StringFieldUpdateOperationsInput | string
    semester?: StringFieldUpdateOperationsInput | string
    status?: EnumRequestStatusFieldUpdateOperationsInput | $Enums.RequestStatus
    qrPayload?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    student?: UserUpdateOneRequiredWithoutClearancesNestedInput
    steps?: ClearanceStepUpdateManyWithoutRequestNestedInput
    transactions?: TransactionUpdateManyWithoutRequestNestedInput
  }

  export type ClearanceRequestUncheckedUpdateWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string
    academicYear?: StringFieldUpdateOperationsInput | string
    semester?: StringFieldUpdateOperationsInput | string
    status?: EnumRequestStatusFieldUpdateOperationsInput | $Enums.RequestStatus
    qrPayload?: NullableStringFieldUpdateOperationsInput | string | null
    studentId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    steps?: ClearanceStepUncheckedUpdateManyWithoutRequestNestedInput
    transactions?: TransactionUncheckedUpdateManyWithoutRequestNestedInput
  }

  export type ClearanceRequestUncheckedUpdateManyWithoutOrganizationInput = {
    id?: StringFieldUpdateOperationsInput | string
    academicYear?: StringFieldUpdateOperationsInput | string
    semester?: StringFieldUpdateOperationsInput | string
    status?: EnumRequestStatusFieldUpdateOperationsInput | $Enums.RequestStatus
    qrPayload?: NullableStringFieldUpdateOperationsInput | string | null
    studentId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClearanceRequestCreateManyStudentInput = {
    id?: string
    academicYear: string
    semester: string
    status?: $Enums.RequestStatus
    qrPayload?: string | null
    organizationId: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ClearanceStepCreateManyClearedByInput = {
    id?: string
    nodeName: string
    status?: $Enums.StepStatus
    remarks?: string | null
    requestId: string
    updatedAt?: Date | string
  }

  export type ClearanceRequestUpdateWithoutStudentInput = {
    id?: StringFieldUpdateOperationsInput | string
    academicYear?: StringFieldUpdateOperationsInput | string
    semester?: StringFieldUpdateOperationsInput | string
    status?: EnumRequestStatusFieldUpdateOperationsInput | $Enums.RequestStatus
    qrPayload?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    organization?: OrganizationUpdateOneRequiredWithoutClearancesNestedInput
    steps?: ClearanceStepUpdateManyWithoutRequestNestedInput
    transactions?: TransactionUpdateManyWithoutRequestNestedInput
  }

  export type ClearanceRequestUncheckedUpdateWithoutStudentInput = {
    id?: StringFieldUpdateOperationsInput | string
    academicYear?: StringFieldUpdateOperationsInput | string
    semester?: StringFieldUpdateOperationsInput | string
    status?: EnumRequestStatusFieldUpdateOperationsInput | $Enums.RequestStatus
    qrPayload?: NullableStringFieldUpdateOperationsInput | string | null
    organizationId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    steps?: ClearanceStepUncheckedUpdateManyWithoutRequestNestedInput
    transactions?: TransactionUncheckedUpdateManyWithoutRequestNestedInput
  }

  export type ClearanceRequestUncheckedUpdateManyWithoutStudentInput = {
    id?: StringFieldUpdateOperationsInput | string
    academicYear?: StringFieldUpdateOperationsInput | string
    semester?: StringFieldUpdateOperationsInput | string
    status?: EnumRequestStatusFieldUpdateOperationsInput | $Enums.RequestStatus
    qrPayload?: NullableStringFieldUpdateOperationsInput | string | null
    organizationId?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClearanceStepUpdateWithoutClearedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    nodeName?: StringFieldUpdateOperationsInput | string
    status?: EnumStepStatusFieldUpdateOperationsInput | $Enums.StepStatus
    remarks?: NullableStringFieldUpdateOperationsInput | string | null
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    request?: ClearanceRequestUpdateOneRequiredWithoutStepsNestedInput
  }

  export type ClearanceStepUncheckedUpdateWithoutClearedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    nodeName?: StringFieldUpdateOperationsInput | string
    status?: EnumStepStatusFieldUpdateOperationsInput | $Enums.StepStatus
    remarks?: NullableStringFieldUpdateOperationsInput | string | null
    requestId?: StringFieldUpdateOperationsInput | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClearanceStepUncheckedUpdateManyWithoutClearedByInput = {
    id?: StringFieldUpdateOperationsInput | string
    nodeName?: StringFieldUpdateOperationsInput | string
    status?: EnumStepStatusFieldUpdateOperationsInput | $Enums.StepStatus
    remarks?: NullableStringFieldUpdateOperationsInput | string | null
    requestId?: StringFieldUpdateOperationsInput | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClearanceStepCreateManyRequestInput = {
    id?: string
    nodeName: string
    status?: $Enums.StepStatus
    remarks?: string | null
    clearedById?: string | null
    updatedAt?: Date | string
  }

  export type TransactionCreateManyRequestInput = {
    id?: string
    amount: Decimal | DecimalJsLike | number | string
    referenceNo: string
    proofUrl?: string | null
    verified?: boolean
    createdAt?: Date | string
  }

  export type ClearanceStepUpdateWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    nodeName?: StringFieldUpdateOperationsInput | string
    status?: EnumStepStatusFieldUpdateOperationsInput | $Enums.StepStatus
    remarks?: NullableStringFieldUpdateOperationsInput | string | null
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    clearedBy?: UserUpdateOneWithoutStepsApprovedNestedInput
  }

  export type ClearanceStepUncheckedUpdateWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    nodeName?: StringFieldUpdateOperationsInput | string
    status?: EnumStepStatusFieldUpdateOperationsInput | $Enums.StepStatus
    remarks?: NullableStringFieldUpdateOperationsInput | string | null
    clearedById?: NullableStringFieldUpdateOperationsInput | string | null
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClearanceStepUncheckedUpdateManyWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    nodeName?: StringFieldUpdateOperationsInput | string
    status?: EnumStepStatusFieldUpdateOperationsInput | $Enums.StepStatus
    remarks?: NullableStringFieldUpdateOperationsInput | string | null
    clearedById?: NullableStringFieldUpdateOperationsInput | string | null
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionUpdateWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    amount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    referenceNo?: StringFieldUpdateOperationsInput | string
    proofUrl?: NullableStringFieldUpdateOperationsInput | string | null
    verified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionUncheckedUpdateWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    amount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    referenceNo?: StringFieldUpdateOperationsInput | string
    proofUrl?: NullableStringFieldUpdateOperationsInput | string | null
    verified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionUncheckedUpdateManyWithoutRequestInput = {
    id?: StringFieldUpdateOperationsInput | string
    amount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    referenceNo?: StringFieldUpdateOperationsInput | string
    proofUrl?: NullableStringFieldUpdateOperationsInput | string | null
    verified?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}