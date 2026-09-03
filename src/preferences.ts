export interface PreferenceOption {
  key: string
  name: string
}

export interface PreferenceCategory {
  id: string
  name: string
  options: PreferenceOption[]
}

// Sumyca "Preference filter" kataloğu: key değerleri Sumyca API'sindeki keyword key'leriyle eşleşir.
export const PREFERENCE_CATEGORIES: PreferenceCategory[] = [
  {
    id: 'feature',
    name: 'Preference',
    options: [
      { key: 'ForeignerWelcomed', name: 'Foreigners OK' },
      { key: 'Designers', name: 'Designers' },
      { key: 'StayWithChildren', name: 'Kids OK' },
      { key: 'LongTermStay', name: 'Long Term' },
      { key: 'TemporaryHomecoming', name: 'Temporarily return' },
      { key: 'TryCohabitation', name: 'Try Cohabitation' },
    ],
  },
  {
    id: 'fixture',
    name: 'Fixture',
    options: [
      { key: 'Kitchenware', name: 'Kitchen supplies' },
      { key: 'ToiletSet', name: 'Toiletries' },
      { key: 'Tableware', name: 'Tableware' },
      { key: 'Towel', name: 'Towels' },
      { key: 'LaundryArticle', name: 'Laundry supplies' },
      { key: 'Slipper', name: 'Slippers' },
      { key: 'CleaningTool', name: 'Cleaning utensils' },
      { key: 'HairDryer', name: 'Hair dryer' },
      { key: 'BathSupplies', name: 'Bath products' },
      { key: 'WashingClothes', name: 'Laundry area' },
    ],
  },
  {
    id: 'furniture',
    name: 'Furniture',
    options: [
      { key: 'DiningSet', name: 'Dining table&chairs' },
      { key: 'SofaAndChair', name: 'Sofa/Chair' },
      { key: 'Desk', name: 'Desk' },
      { key: 'Table', name: 'Table' },
    ],
  },
  {
    id: 'room',
    name: 'Room facility',
    options: [
      { key: 'HotWaterSupply', name: 'Hot water' },
      { key: 'AirConditioner', name: 'Air conditioner' },
      { key: 'BathAndToiletSeparated', name: 'Wet and dry separation' },
      { key: 'Closet', name: 'Wardrobe' },
      { key: 'Bidet', name: 'Bidet' },
      { key: 'IHCooker', name: 'IH Cooker' },
      { key: 'MobileWiFi', name: 'Pocket WIFI' },
      { key: 'GasStove', name: 'Gas stove' },
      { key: 'FixedWiFi', name: 'Fixed WIFI' },
      { key: 'ElectricStove', name: 'Electric stove' },
      { key: 'BathroomDryer', name: 'Bathroom Dryer' },
      { key: 'Maisonette', name: 'Maisonette' },
    ],
  },
]

export const ALL_PREFERENCE_KEYS = new Set(PREFERENCE_CATEGORIES.flatMap((c) => c.options.map((o) => o.key)))
