import { NextResponse } from 'next/server';
import { fail, guard } from '@/lib/api';
import { deleteComment, editComment, getComment } from '@/lib/store';

// Editing a comment: its author only. Deleting: its author or an admin.
async function own(request, params, { adminToo }) {
  const { error, user } = await guard(request);
  if (error) return { error };
  const { id } = await params;
  const comment = await getComment(id);
  if (!comment) return { error: NextResponse.json({ error: 'That comment no longer exists.' }, { status: 404 }) };
  const mine = user.local || (comment.author_id && comment.author_id === user.id);
  if (!mine && !(adminToo && user.role === 'admin')) return { error: NextResponse.json({ error: 'You can only change your own comments.' }, { status: 403 }) };
  return { id };
}

export async function PATCH(request, { params }) {
  try {
    const { error, id } = await own(request, params, { adminToo: false });
    if (error) return error;
    return NextResponse.json({ comment: await editComment(id, (await request.json()).body) });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { error, id } = await own(request, params, { adminToo: true });
    if (error) return error;
    await deleteComment(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
