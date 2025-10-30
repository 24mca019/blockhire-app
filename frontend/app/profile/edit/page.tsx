"use client"

import type React from "react"
import Layout from "../../../components/Layout"
import ProtectedRoute from "../../../components/ProtectedRoute"
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { useAuth } from "../../../contexts/AuthContext"
import { ProfileFormData, DocumentRecord } from "@/types/api"
import { apiService } from "@/services/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertCircle, Upload, FileText } from "lucide-react"
import { validateFile } from "../../../lib/validation"
import { MobileInput } from "@/components/ui/mobile-input"
import { ethers, Eip1193Provider } from "ethers"

// --- ⛓️ Web3 Constants ---
const contractAddress = "0xc9Dd39b2df5F2E1BbC4633c7Bc86D798837d2b4d";
const contractABI = [
    {
        "inputs": [
            { "internalType": "string", "name": "empId", "type": "string" },
            { "internalType": "string", "name": "userHash", "type": "string" },
            { "internalType": "string", "name": "email", "type": "string" },
            { "internalType": "string", "name": "originalDocHash", "type": "string" },
            { "internalType": "string", "name": "storagePath", "type": "string" }
        ],
        "name": "registerUser",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];
const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7"; // Hex for 11155111
const SEPOLIA_CHAIN_ID_NUM = 11155111;

// Extend window type to include ethereum
declare global {
    interface Window {
        ethereum?: Eip1193Provider & { isMetaMask?: boolean };
    }
}

// Validation schema
const profileSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  mobile: z.string()
    .min(10, "Mobile number must be at least 10 digits")
    .max(15, "Mobile number cannot exceed 15 digits")
    .regex(/^[\+]?[1-9][\d]{9,14}$/, "Please enter a valid mobile number"),
  address: z.string().min(10, "Address must be at least 10 characters"),
  jobDesignation: z.string().min(2, "Job designation is required"),
  department: z.string().min(2, "Department is required"),
});

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, userProfile, credentials, refreshProfile } = useAuth();
  const [step, setStep] = useState<"personal" | "contact" | "employment">("personal");
  const [isHashing, setIsHashing] = useState(false);
  const [txStatus, setTxStatus] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [documentHistory, setDocumentHistory] = useState<DocumentRecord[]>([]);
  
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    mode: 'onBlur', // Validate on blur for better user experience
    defaultValues: {
      firstName: "", lastName: "", dateOfBirth: "", mobile: "",
      address: "", jobDesignation: "", department: "",
    },
  });

  // ✨ ADDED `trigger` to implement step-wise validation
  const { formState: { errors }, setValue, trigger } = form;
  
  useEffect(() => {
    // This effect now correctly populates the form on initial load
    // or when the user profile is externally updated (e.g., after login).
    if (userProfile) {
      Object.keys(userProfile).forEach(key => {
        const profileKey = key as keyof ProfileFormData;
        if (profileKey in form.getValues()) {
          setValue(profileKey, userProfile[profileKey] as string);
        }
      });
    }

    // Load document history independently
    const loadDocumentHistory = async () => {
      try {
        const response = await apiService.getDocumentHistory();
        setDocumentHistory(response.success && response.data ? response.data : []);
      } catch (error) {
        console.error("Error loading document history:", error);
        setDocumentHistory([]);
      }
    };
    if (user) {
      loadDocumentHistory();
    }
  }, [user, userProfile, setValue]);

  // ✨ FIX: `onNext` now actively validates only the fields in the current step.
  const onNext = async () => {
    setMessage(null); // Clear previous messages
    if (step === "personal") {
      const isValid = await trigger(["firstName", "lastName", "dateOfBirth"]);
      if (isValid) setStep("contact");
    } else if (step === "contact") {
      const isValid = await trigger(["mobile", "address"]);
      if (isValid) setStep("employment");
    }
  };

  // ✨ FIX: `onFile` now only updates the document list, preserving form state.
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileError = validateFile(file);
    if (fileError) {
      setMessage({ type: "error", text: fileError });
      return;
    }

    setIsHashing(true);
    setMessage(null);
    try {
      const response = await apiService.uploadDocument(file);
      if (response.success && response.data) {
        // Manually add the new document to the state instead of a full refresh
        setDocumentHistory(prevDocs => [...prevDocs, response.data!]);
        setMessage({ type: "success", text: "Document uploaded successfully!" });
      } else {
        throw new Error(response.error || "Failed to upload document");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setIsHashing(false);
    }
  };

  const onSave = async (data: ProfileFormData) => {
    setIsSubmitting(true);
    setMessage(null);
    setTxStatus("");

    // Step 1: Save Profile to Database
    try {
      const response = await apiService.updateProfile(data);
      if (!response.success) throw new Error(response.error || "Failed to update profile.");
      setMessage({ type: "success", text: "Profile saved! Preparing blockchain transaction..." });
      await refreshProfile(); // Refresh profile AFTER saving
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to save profile." });
      setIsSubmitting(false);
      return;
    }

    // Step 2: Register on Blockchain
    try {
      if (!window.ethereum) throw new Error("MetaMask is not installed.");
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();

      if (network.chainId !== BigInt(SEPOLIA_CHAIN_ID_NUM)) {
        setTxStatus("Wrong network. Requesting switch to Sepolia...");
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }] });
      }

      setTxStatus("Please connect your wallet to proceed.");
      const signer = await provider.getSigner();
      
      const latestUserProfile = await apiService.getProfile(); // Get the very latest data
      const latestDocs = await apiService.getDocumentHistory();
      const docToRegister = latestDocs.data?.find(doc => doc.isOriginal) ?? latestDocs.data?.[latestDocs.data.length - 1];

      if (!credentials?.empId || !latestUserProfile.data?.userHash || !credentials?.email || !docToRegister) {
        throw new Error("Missing required data for transaction. Ensure profile is complete and a document is uploaded.");
      }
      
      const contract = new ethers.Contract(contractAddress, contractABI, signer);
      
      setTxStatus("Please confirm the transaction in MetaMask...");
      const tx = await contract.registerUser(
        credentials.empId, latestUserProfile.data.userHash, credentials.email,
        docToRegister.docHash, docToRegister.storagePath
      );
      
      setTxStatus("Transaction sent! Waiting for confirmation...");
      await tx.wait();

      setMessage({ type: "success", text: "Profile and blockchain record saved successfully!" });
      setTxStatus(`Success! View on Etherscan: ${tx.hash}`);

      setTimeout(() => router.push("/profile/info"), 3000);

    } catch (err: any) {
      console.error("Blockchain Transaction Error:", err);
      let errorMessage = err.reason || "An error occurred during the transaction.";
      if (err.code === 4001) errorMessage = "Transaction rejected in MetaMask.";
      setMessage({ type: "error", text: errorMessage });
      setTxStatus("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProgressPercentage = () => ((["personal", "contact", "employment"].indexOf(step) + 1) / 3) * 100;

  return (
    <ProtectedRoute>
      <Layout>
        <div className="container max-w-4xl mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Edit Profile</h1>
            <p className="text-gray-600 mt-2">Complete your profile information step by step</p>
          </div>
          
          <div className="mb-8">
             <Progress value={getProgressPercentage()} className="h-2" />
          </div>

          <div className="flex space-x-1 mb-8 border-b">
             {[
               { id: "personal", label: "Personal Info", icon: "👤" },
               { id: "contact", label: "Contact Details", icon: "📞" },
               { id: "employment", label: "Employment", icon: "💼" },
             ].map((tab) => (
               <button
                 key={tab.id}
                 onClick={() => setStep(tab.id as any)}
                 className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                   step === tab.id
                     ? "border-blue-500 text-blue-600"
                     : "border-transparent text-gray-500 hover:text-gray-700"
                 }`}
               >
                 <span className="mr-2">{tab.icon}</span>
                 {tab.label}
               </button>
             ))}
          </div>

          {message && (
            <Alert className={`mb-6 ${message.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              {message.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={form.handleSubmit(onSave)}>
            {step === "personal" && (
              <Card>
                <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input id="firstName" {...form.register("firstName")} />
                    {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input id="lastName" {...form.register("lastName")} />
                    {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                    <Input id="dateOfBirth" type="date" {...form.register("dateOfBirth")} />
                    {errors.dateOfBirth && <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth.message}</p>}
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" onClick={onNext}>Next Step</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === "contact" && (
                 <Card>
                    <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <MobileInput
                          id="mobile"
                          label="Mobile Number *"
                          {...form.register("mobile")}
                          error={errors.mobile?.message}
                          onValueChange={(value) => form.setValue("mobile", value)}
                        />
                        <div>
                            <Label htmlFor="address">Address *</Label>
                            <Input id="address" {...form.register("address")} />
                            {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address.message}</p>}
                        </div>
                        <div className="flex justify-between">
                            <Button type="button" variant="outline" onClick={() => setStep("personal")}>Previous</Button>
                            <Button type="button" onClick={onNext}>Next Step</Button>
                        </div>
                    </CardContent>
                 </Card>
            )}

            {step === "employment" && (
              <Card>
                <CardHeader><CardTitle>Employment & Verification</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div>
                      <Label htmlFor="jobDesignation">Job Designation *</Label>
                      <Input id="jobDesignation" {...form.register("jobDesignation")} />
                      {errors.jobDesignation && <p className="text-red-500 text-sm mt-1">{errors.jobDesignation.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="department">Department *</Label>
                      <Input id="department" {...form.register("department")} />
                      {errors.department && <p className="text-red-500 text-sm mt-1">{errors.department.message}</p>}
                    </div>
                    {/* Document Upload Section */}
                    <div className="border-t pt-6">
                        <h3 className="text-lg font-medium mb-2">Document Verification</h3>
                        <div className="border-2 border-dashed rounded-lg p-6 text-center">
                          <label htmlFor="file-upload" className="cursor-pointer font-medium text-blue-600 hover:text-blue-500">
                            Upload a PDF document
                            <input id="file-upload" type="file" accept=".pdf" onChange={onFile} className="sr-only" />
                          </label>
                          <p className="text-xs text-gray-500 mt-1">PDF only, max 10MB</p>
                        </div>
                        {isHashing && <p className="text-blue-600 text-sm mt-2">Hashing document...</p>}
                        <div className="mt-4 space-y-2">
                            {documentHistory.map((doc) => (
                                <div key={doc.docHash} className="p-2 border rounded-md bg-gray-50 text-sm">
                                    <p className="font-medium truncate">{doc.fileName}</p>
                                    <p className="text-xs text-gray-500 font-mono break-all">{doc.docHash}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Transaction Status */}
                    {txStatus && (
                      <Alert className="border-blue-200 bg-blue-50 text-blue-800">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="break-all">
                            {txStatus.startsWith('Success!') ? (
                                <>
                                    <strong>Success!</strong>
                                    <a href={`https://sepolia.etherscan.io/tx/${txStatus.split(': ')[1]}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs block mt-1 underline">
                                        View on Etherscan
                                    </a>
                                </>
                            ) : txStatus}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="flex justify-between border-t pt-6">
                      <Button type="button" variant="outline" onClick={() => setStep("contact")}>Previous</Button>
                      <Button type="submit" disabled={isSubmitting || documentHistory.length === 0}>
                        {isSubmitting ? "Saving..." : "Save & Issue to Blockchain"}
                      </Button>
                    </div>
                </CardContent>
              </Card>
            )}
          </form>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}