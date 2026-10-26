import { NextResponse } from 'next/server';
import { fail, guard } from '@/lib/api';
import { addComment, listComments } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { error } = await guard(request);
  if (error) return error;
  try {
    const { id } = await params;
    return NextResponse.json({ comments: await listComments(id) });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request, { params }) {
  const { error, user } = await guard(request);
  if (error) return error;
  try {
    const { id } = await params;
    const { body } = await request.json();
    return NextResponse.json({ comment: await addComment(id, body, user) });
  } catch (err) {
    return fail(err);
  }
}
