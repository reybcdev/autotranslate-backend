#!/usr/bin/env node
import 'dotenv/config'
import process from 'node:process'
import { supabase } from '../src/config/supabase.js'

const getArgValue = (name) => {
  const prefix = `${name}=`
  const raw = process.argv.slice(2).find(arg => arg.startsWith(prefix))
  return raw ? raw.slice(prefix.length) : null
}

const userId = getArgValue('--user-id')
const email = getArgValue('--email')
const fullName = getArgValue('--name') || 'Admin User'
const creditsArg = getArgValue('--credits')
const credits = creditsArg ? Number(creditsArg) : null

if (!userId) {
  console.error('Usage: node scripts/seedAdmin.js --user-id=<uuid> [--email=<email>] [--name="Full Name"] [--credits=999]')
  process.exit(1)
}

const ensureNumber = (value) => (typeof value === 'number' && !Number.isNaN(value) ? value : null)

const bootstrapAdmin = async () => {
  console.log(`⏳ Bootstrapping admin profile for user ${userId}`)

  const { data: existingProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (fetchError) {
    console.error('Failed to query profiles table:', fetchError.message)
    process.exit(1)
  }

  if (existingProfile) {
    const updates = {
      role: 'admin'
    }

    if (email) updates.email = email
    if (fullName) updates.full_name = fullName
    if (ensureNumber(credits) !== null) updates.credits = credits

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Failed to update existing profile:', error.message)
      process.exit(1)
    }

    console.log('✅ Updated existing profile to admin:', data)
    return
  }

  if (!email) {
    console.error('No existing profile found and --email was not provided. Cannot create profile without email.')
    process.exit(1)
  }

  const insertPayload = {
    id: userId,
    email,
    full_name: fullName,
    role: 'admin'
  }

  if (ensureNumber(credits) !== null) {
    insertPayload.credits = credits
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    console.error('Failed to create admin profile:', error.message)
    process.exit(1)
  }

  console.log('✅ Admin profile created:', data)
}

bootstrapAdmin()
  .then(() => {
    console.log('🎉 Admin seeding completed')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Unexpected error:', err)
    process.exit(1)
  })
