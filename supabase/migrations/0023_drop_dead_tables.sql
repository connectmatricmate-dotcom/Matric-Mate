-- Two tables nothing has ever read or written.
--
-- `threads` was the first design for tutor conversations: one row per chat
-- with the messages in a jsonb column. 0009 replaced it with chat_threads plus
-- a chat_messages row per turn, which is what both apps actually use and what
-- holds the eighteen real conversations. The old table was left behind empty.
--
-- `downloads` was going to track offline chapters server-side. Downloads turned
-- out to be a property of a device rather than an account: the files live in
-- the app's private directory and the list of them is local, because a chapter
-- downloaded on a phone is not downloaded on a laptop.
--
-- Both are empty, nothing references them, and no code mentions either. They
-- are removed because a table with no reader is how the notifications bug hid
-- for months: it looked like a working feature from the schema alone.

drop table if exists public.threads;
drop table if exists public.downloads;
