import {
  DefaultNamingStrategy,
  type NamingStrategyInterface,
} from 'typeorm';

function toSnakeCase(value: string): string {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

export class SnakeNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  override tableName(
    targetName: string,
    userSpecifiedName: string | undefined,
  ): string {
    return toSnakeCase(super.tableName(targetName, userSpecifiedName));
  }

  override closureJunctionTableName(originalClosureTableName: string): string {
    return toSnakeCase(super.closureJunctionTableName(originalClosureTableName));
  }

  override columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    return toSnakeCase(
      super.columnName(propertyName, customName ?? '', embeddedPrefixes),
    );
  }

  override relationName(propertyName: string): string {
    return toSnakeCase(super.relationName(propertyName));
  }

  override joinColumnName(
    relationName: string,
    referencedColumnName: string,
  ): string {
    return toSnakeCase(
      super.joinColumnName(relationName, referencedColumnName),
    );
  }

  override joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
    secondPropertyName: string,
  ): string {
    return toSnakeCase(
      super.joinTableName(
        firstTableName,
        secondTableName,
        firstPropertyName,
        secondPropertyName,
      ),
    );
  }

  override joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return toSnakeCase(
      super.joinTableColumnName(tableName, propertyName, columnName),
    );
  }

  override joinTableInverseColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return toSnakeCase(
      super.joinTableInverseColumnName(tableName, propertyName, columnName),
    );
  }

  override prefixTableName(prefix: string, tableName: string): string {
    return toSnakeCase(super.prefixTableName(prefix, tableName));
  }
}
