import { db, must, insertOne, updateOne, deleteOne } from '../lib/supabase.js';
import slugify from 'slugify';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { validate } from '../utils/validate.js';

/** GET /api/categories — tree of categories + subcategories */
export const listCategories = asyncHandler(async (req, res) => {
  const rows = must(await db.from('categories').select('id,name,slug,icon,parent_id,sort_order').order('sort_order'));
  const roots = rows.filter((r) => !r.parent_id).map((r) => ({ ...r, subcategories: rows.filter((s) => s.parent_id === r.id) }));
  res.json({ categories: roots });
});

/** POST /api/admin/categories */
export const createCategory = asyncHandler(async (req, res) => {
  const { name, parent_id: parentId = null, icon = null, sort_order: sortOrder = 0 } = validate({ name: 'required|string|max:80' }, req.body);
  const slug = slugify(name, { lower: true, strict: true });
  const cat = await insertOne('categories', { name, slug, parent_id: parentId, icon, sort_order: sortOrder });
  res.status(201).json({ category: cat });
});

/** PATCH /api/admin/categories/:id */
export const updateCategory = asyncHandler(async (req, res) => {
  const patch = {};
  for (const k of ['name', 'icon', 'sort_order', 'is_active']) if (k in req.body) patch[k] = req.body[k];
  if (patch.name) patch.slug = slugify(patch.name, { lower: true, strict: true });
  res.json({ category: await updateOne('categories', req.params.id, patch) });
});

/** DELETE /api/admin/categories/:id */
export const deleteCategory = asyncHandler(async (req, res) => {
  const inUse = must(await db.from('courses').select('id').eq('category_id', req.params.id).limit(1));
  if (inUse.length) throw HttpError.conflict('Category has courses; move or delete them first');
  await deleteOne('categories', req.params.id);
  res.json({ deleted: true });
});
