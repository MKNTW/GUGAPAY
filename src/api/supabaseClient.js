import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hjdcryfdhqxazdllhjsv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqZGNyeWZkaHF4YXpkbGxoanN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg2MDQyOTUsImV4cCI6MjA1NDE4MDI5NX0.yGYZ2_bkIismVidBNFYTdRRh1rZrfo1rT90UzNxhDWc'

export const supabase = createClient(supabaseUrl, supabaseKey)
