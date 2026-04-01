"use server"

import { signIn } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import{ z } from "zod"

// Only allow emails
const ALLOWED_DOMAINS = ["gmail.com", "hevs.ch", "hes-so.ch", "edu.vs.ch"] 

// Define Zod schema for validating sign-up form data
const SignupSchema = z.object({
  email: z.string()
    .email("Invalid email format")
    .refine((val: string) => {
      return ALLOWED_DOMAINS.some(domain => val.endsWith(`@${domain}`));
    }, { 
      message: "Email must be from an allowed domain."
    }),
  password: z.string()
    .min(8, "8 characters minimum")
    .max(100, "100 characters maximum"),
});

type ActionResponse = string | null | undefined;

/**
 * Server Action to handle new user registration.
 * 1. Checks if the email is already registered.
 * 2. Hashes the password using bcrypt for secure storage.
 * 3. Creates the user in the database.
 * 4. Automatically signs the user in upon successful creation.
 * * @param {ActionResponse} prevState - The previous state (error message or null).
 * @param {FormData} formData - The registration form data (email, password).
 * @returns {Promise<ActionResponse>} Error message if registration fails, otherwise triggers a redirect.
 */
export async function signUpAction(prevState: ActionResponse, formData: FormData): Promise<ActionResponse> {
  try {

    // Validate form data using Zod schema
    const validatedFields = SignupSchema.safeParse(
      Object.fromEntries(formData.entries())
    );

    // If validation fails, return the first error message
    if (!validatedFields.success) {

      return validatedFields.error.issues[0].message;
    }

    // Extract validated email and password
    const { email, password } = validatedFields.data;

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    // Verify if the email is already registered
    if (existingUser) {
      return "User already registered.";
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });


    await signIn("credentials", {
        email,
        password,
        redirectTo: "/dashboard"
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error
    }
    
    console.error("Sign up error:", error)
    return "An error occurred during registration."
  }
}