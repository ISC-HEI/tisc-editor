"use server"

import { signIn } from "@/lib/auth"
import { AuthError } from "next-auth"

type ActionResponse = string | null | undefined;

/**
 * Server Action to handle user login using the 'credentials' provider.
 * This function processes the login form data and manages redirects or errors.
 * * @param {ActionResponse} prevState - The previous state of the action (used with useActionState).
 * @param {FormData} formData - The raw form data containing user credentials (email, password).
 * @returns {Promise<ActionResponse>} A string containing an error message if login fails, or null/redirect on success.
 */
export async function loginAction(prevState: ActionResponse, formData: FormData) {
  try {
    await signIn("credentials", { 
      ...Object.fromEntries(formData), 
      redirectTo: "/dashboard" 
    })
  } catch (error) {
    if (error instanceof Error && error.message?.includes("NEXT_REDIRECT")) {
      throw error
    }

    if (error instanceof AuthError) {
      return "Incorrect credentials."
    }
    
    return "An unexpected error has occurred."
  }
}