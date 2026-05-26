import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, ...params } = await req.json()

    // Helper function to send welcome email
    const sendWelcomeEmail = async (email: string, full_name: string, password: string, role: string, login_url: string) => {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ email, full_name, password, role, login_url }),
        })
        const result = await response.json()
        if (!response.ok) {
          console.error('Failed to send welcome email:', result)
          return { success: false, error: result.error }
        }
        console.log('Welcome email sent successfully to', email)
        return { success: true }
      } catch (error) {
        console.error('Error sending welcome email:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }

    switch (action) {
      case 'list': {
        // Get all users from auth.users via admin API with pagination
        // The default limit is 50, max is 1000 per page
        const allUsers: any[] = []
        let page = 1
        const perPage = 1000
        
        while (true) {
          const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage,
          })
          
          if (listError) {
            throw listError
          }
          
          allUsers.push(...authUsers.users)
          
          // If we got fewer users than perPage, we've reached the end
          if (authUsers.users.length < perPage) {
            break
          }
          
          page++
        }
        
        console.log(`Fetched ${allUsers.length} total users across ${page} page(s)`)

        // Get all user roles
        const { data: roles, error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .select('user_id, role')

        if (rolesError) {
          throw rolesError
        }

        // Get all profiles
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from('profiles')
          .select('id, email, full_name')

        if (profilesError) {
          throw profilesError
        }

        // Combine the data
        const users = allUsers.map((authUser) => {
          const userRole = roles?.find((r) => r.user_id === authUser.id)
          const profile = profiles?.find((p) => p.id === authUser.id)
          return {
            id: authUser.id,
            email: authUser.email,
            full_name: profile?.full_name || authUser.user_metadata?.full_name || '',
            role: userRole?.role || 'viewer',
            created_at: authUser.created_at,
            last_sign_in_at: authUser.last_sign_in_at,
          }
        })

        return new Response(
          JSON.stringify({ users }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'create': {
        const { email, password, full_name, role, send_welcome_email, login_url } = params

        if (!email || !password) {
          return new Response(
            JSON.stringify({ error: 'Email and password are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Create user via admin API
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // Auto-confirm email
          user_metadata: { full_name: full_name || email },
        })

        if (createError) {
          return new Response(
            JSON.stringify({ error: createError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // The handle_new_user trigger creates the profile and default role
        // If a different role is specified, update it
        if (role && role !== 'viewer') {
          await supabaseAdmin
            .from('user_roles')
            .update({ role })
            .eq('user_id', newUser.user.id)
        }

        // Send welcome email if requested
        let emailResult = null
        if (send_welcome_email && login_url) {
          emailResult = await sendWelcomeEmail(email, full_name || email, password, role || 'viewer', login_url)
        }

        return new Response(
          JSON.stringify({ success: true, user: newUser.user, email_sent: emailResult }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'send_invite': {
        const { user_id, email, full_name, role, login_url } = params

        if (!user_id || !email) {
          return new Response(
            JSON.stringify({ error: 'User ID and email are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Generate a new temporary password
        const tempPassword = generateTempPassword()

        // Update user password
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          password: tempPassword,
        })

        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Send welcome email with new temporary password
        const emailResult = await sendWelcomeEmail(email, full_name || email, tempPassword, role || 'viewer', login_url)

        if (!emailResult.success) {
          return new Response(
            JSON.stringify({ error: emailResult.error || 'Failed to send email' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log(`Invite sent to ${email} by admin ${user.id}`)

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'send_bulk_invites': {
        const { users: usersToInvite, login_url } = params

        if (!usersToInvite || !Array.isArray(usersToInvite) || usersToInvite.length === 0) {
          return new Response(
            JSON.stringify({ error: 'No users to invite' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const results = []
        for (const userToInvite of usersToInvite) {
          try {
            // Generate a new temporary password
            const tempPassword = generateTempPassword()

            // Update user password
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userToInvite.id, {
              password: tempPassword,
            })

            if (updateError) {
              results.push({ user_id: userToInvite.id, email: userToInvite.email, success: false, error: updateError.message })
              continue
            }

            // Send welcome email
            const emailResult = await sendWelcomeEmail(
              userToInvite.email,
              userToInvite.full_name || userToInvite.email,
              tempPassword,
              userToInvite.role || 'viewer',
              login_url
            )

            results.push({ 
              user_id: userToInvite.id, 
              email: userToInvite.email, 
              success: emailResult.success,
              error: emailResult.error 
            })
          } catch (error) {
            results.push({ 
              user_id: userToInvite.id, 
              email: userToInvite.email, 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            })
          }
        }

        const successCount = results.filter(r => r.success).length
        console.log(`Bulk invites sent: ${successCount}/${results.length} successful by admin ${user.id}`)

        return new Response(
          JSON.stringify({ success: true, results, successCount, totalCount: results.length }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update_role': {
        const { user_id, role } = params

        if (!user_id || !role) {
          return new Response(
            JSON.stringify({ error: 'User ID and role are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Prevent admin from changing their own role
        if (user_id === user.id) {
          return new Response(
            JSON.stringify({ error: 'Cannot change your own role' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { error: updateError } = await supabaseAdmin
          .from('user_roles')
          .update({ role })
          .eq('user_id', user_id)

        if (updateError) {
          throw updateError
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'delete': {
        const { user_id } = params

        if (!user_id) {
          return new Response(
            JSON.stringify({ error: 'User ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Prevent admin from deleting themselves
        if (user_id === user.id) {
          return new Response(
            JSON.stringify({ error: 'Cannot delete your own account' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id)

        if (deleteError) {
          throw deleteError
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'reset_password': {
        const { user_id, new_password } = params

        if (!user_id || !new_password) {
          return new Response(
            JSON.stringify({ error: 'User ID and new password are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (new_password.length < 6) {
          return new Response(
            JSON.stringify({ error: 'Password must be at least 6 characters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          password: new_password,
        })

        if (resetError) {
          const errAny = resetError as unknown as { code?: string; status?: number; message?: string }
          if (errAny?.code === 'weak_password' || errAny?.status === 422) {
            return new Response(
              JSON.stringify({
                error: 'This password has been found in known data breaches. Please choose a stronger, unique password.',
                code: 'weak_password',
              }),
              { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          throw resetError
        }

        console.log(`Password reset for user ${user_id} by admin ${user.id}`)

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Generate a random temporary password
function generateTempPassword(): string {
  // Use 20 cryptographically random chars including symbols so the result is
  // effectively guaranteed not to appear in the HIBP pwned-passwords database.
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*-_=+'
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  let password = ''
  for (let i = 0; i < bytes.length; i++) {
    password += chars.charAt(bytes[i] % chars.length)
  }
  return password
}
