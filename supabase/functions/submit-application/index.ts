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

    const formData = await req.formData();
    
    const fullName = formData.get("fullName") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const location = formData.get("location") as string;
    const role = formData.get("role") as string;
    const dob = formData.get("dob") as string;
    const linkedin = formData.get("linkedin") as string;
    const whyUs = formData.get("whyUs") as string;
    const joinTalentPool = formData.get("joinTalentPool") === "true";
    const cvFile = formData.get("cv") as File;

    console.log("Received application:", { fullName, email, phone, location, role });

    let cvUrl = null;

    // Upload CV if provided
    if (cvFile && cvFile.size > 0) {
      const timestamp = Date.now();
      const sanitizedName = fullName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      const fileExt = cvFile.name.split(".").pop();
      const filePath = `applications/${sanitizedName}_${timestamp}.${fileExt}`;

      console.log("Uploading CV to path:", filePath);

      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from("employee-cvs")
        .upload(filePath, cvFile, {
          contentType: cvFile.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("CV upload error:", uploadError);
        throw new Error(`Failed to upload CV: ${uploadError.message}`);
      }

      // Get the public URL
      const { data: urlData } = supabaseClient.storage
        .from("employee-cvs")
        .getPublicUrl(filePath);

      cvUrl = urlData.publicUrl;
      console.log("CV uploaded successfully:", cvUrl);
    }

    // For now, we'll log the application. In a full implementation,
    // you might want to store this in a separate applications table
    // or send it via email notification
    console.log("Application submitted:", {
      fullName,
      email,
      phone,
      location,
      role,
      dob,
      linkedin,
      whyUs,
      joinTalentPool,
      cvUrl,
      submittedAt: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Application submitted successfully",
        cvUrl 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Application submission error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
