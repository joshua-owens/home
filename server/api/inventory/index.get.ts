import { InventoryItem } from '../../database/entities'
export default defineEventHandler(async () => (await useDb()).getRepository(InventoryItem).find())
