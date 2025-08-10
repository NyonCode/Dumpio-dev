// Utility pro převod JSON objektů na více-úrovňové pole

export interface ArrayItem {
  key: string
  value: any
  type: string
  level: number
  hasChildren: boolean
}

export function convertToArray(obj: any, level: number = 0, parentKey: string = ''): ArrayItem[] {
  const result: ArrayItem[] = []

  if (obj === null || obj === undefined) {
    return [
      {
        key: parentKey || 'value',
        value: obj,
        type: obj === null ? 'null' : 'undefined',
        level,
        hasChildren: false
      }
    ]
  }

  if (Array.isArray(obj)) {
    // Pro pole - každý prvek jako samostatný item
    obj.forEach((item, index) => {
      const key = parentKey ? `${parentKey}[${index}]` : `[${index}]`

      if (typeof item === 'object' && item !== null) {
        // Přidat hlavičku pole
        result.push({
          key,
          value: `Array(${Array.isArray(item) ? item.length : Object.keys(item).length})`,
          type: Array.isArray(item) ? 'array' : 'object',
          level,
          hasChildren: true
        })

        // Rekurzivně přidat obsah
        result.push(...convertToArray(item, level + 1, key))
      } else {
        result.push({
          key,
          value: item,
          type: typeof item,
          level,
          hasChildren: false
        })
      }
    })
  } else if (typeof obj === 'object') {
    // Pro objekty - každá vlastnost jako item
    Object.entries(obj).forEach(([key, value]) => {
      const fullKey = parentKey ? `${parentKey}.${key}` : key

      if (typeof value === 'object' && value !== null) {
        // Přidat hlavičku objektu/pole
        result.push({
          key: fullKey,
          value: Array.isArray(value)
            ? `Array(${value.length})`
            : `Object(${Object.keys(value).length})`,
          type: Array.isArray(value) ? 'array' : 'object',
          level,
          hasChildren: true
        })

        // Rekurzivně přidat obsah
        result.push(...convertToArray(value, level + 1, fullKey))
      } else {
        result.push({
          key: fullKey,
          value,
          type: typeof value,
          level,
          hasChildren: false
        })
      }
    })
  } else {
    // Primitivní hodnoty
    result.push({
      key: parentKey || 'value',
      value: obj,
      type: typeof obj,
      level,
      hasChildren: false
    })
  }

  return result
}

export function formatArrayForCopy(obj: any): any[] {
  // Speciální formátování pro kopírování jako array
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null ? formatArrayForCopy(item) : item
    )
  } else if (typeof obj === 'object' && obj !== null) {
    // Převést objekt na array key-value párů
    return Object.entries(obj).map(([key, value]) => ({
      key,
      value: typeof value === 'object' && value !== null ? formatArrayForCopy(value) : value
    }))
  } else {
    // Pro primitivní hodnoty vytvořit array s jedním prvkem
    return [obj]
  }
}
