import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { employeeData } = await req.json();

    // Generate next serial employee code
    const { data: existingCodes } = await supabaseClient
      .from("employees")
      .select("employee_code")
      .like("employee_code", "EDU%");

    let nextNumber = 15; // Start from 15 as requested
    if (existingCodes && existingCodes.length > 0) {
      const numbers = existingCodes
        .map((e) => {
          const match = e.employee_code.match(/^EDU(\d+)$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((n) => n > 0);
      
      if (numbers.length > 0) {
        nextNumber = Math.max(...numbers) + 1;
      }
    }
    
    const employeeCode = `EDU${String(nextNumber).padStart(2, "0")}`;

    // Create auth user
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email: employeeData.email,
      email_confirm: true,
    });

    if (authError) {
      throw authError;
    }

    // Create employee record with pending status
    const { data: empData, error: empError } = await supabaseClient
      .from("employees")
      .insert({
        user_id: authData.user.id,
        employee_code: employeeCode,
        first_name: employeeData.first_name,
        last_name: employeeData.last_name,
        email: employeeData.email,
        phone: employeeData.phone,
        hire_date: new Date().toISOString().split('T')[0],
        registration_status: "pending",
      })
      .select()
      .single();

    if (empError) {
      throw empError;
    }

    return new Response(JSON.stringify({ success: true, employee: empData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});