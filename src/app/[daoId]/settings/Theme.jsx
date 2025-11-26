"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useDao } from "@/context/DaoContext";
import { useNearWallet } from "@/context/NearWalletContext";
import { useProposalToastContext } from "@/context/ProposalToastContext";
import { encodeToMarkdown } from "@/helpers/daoHelpers";
import TransactionLoader from "@/components/proposals/TransactionLoader";
import InsufficientBannerModal from "@/components/proposals/InsufficientBannerModal";
import Skeleton from "@/components/ui/Skeleton";
import { logger } from "@/helpers/logger";
import { REFRESH_DELAY } from "@/constants/ui";

const Theme = () => {
  const {
    watch,
    setValue,
    reset,
    formState: { isDirty },
  } = useForm({
    defaultValues: {
      image: "",
      color: "#01BF7A",
    },
  });

  const {
    daoId: treasuryDaoID,
    hasPermission,
    daoConfig: config,
    daoPolicy: policy,
  } = useDao();
  const { accountId, signAndSendTransactions } = useNearWallet();
  const { showToast } = useProposalToastContext();

  const [error, setError] = useState(null);
  const [isTxnCreated, setTxnCreated] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadButtonDisabled, setUploadButtonDisabled] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Watch form values
  const image = watch("image");
  const color = watch("color");

  const hasCreatePermission = hasPermission?.("config", "AddProposal");

  useEffect(() => {
    if (config) {
      const metadata = config.metadata;
      const defaultImage =
        metadata?.flagLogo ||
        "https://github.com/user-attachments/assets/244e15fc-3fb7-4067-a2c3-013e189e8d20";
      const defaultColor = metadata?.primaryColor || "#01BF7A";

      reset({
        image: defaultImage,
        color: defaultColor,
      });
      setLoadingConfig(false);
    }
  }, [config, reset]);

  const uploadImageToServer = async (file) => {
    setUploadingImage(true);
    setUploadButtonDisabled(true);
    setError(null);

    try {
      const response = await fetch("https://ipfs.near.social/add", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: file,
      });

      const result = await response.json();
      if (result.cid) {
        const imageUrl = `https://ipfs.near.social/ipfs/${result.cid}`;
        setValue("image", imageUrl, { shouldDirty: true });
      } else {
        setError("Error occurred while uploading image, please try again.");
      }
    } catch (error) {
      logger.error("Upload error:", error);
      setError("Error occurred while uploading image, please try again.");
    } finally {
      setUploadingImage(false);
      setUploadButtonDisabled(false);
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();

      reader.onload = () => {
        const img = new Image();
        img.src = reader.result;

        img.onload = () => {
          // Check dimensions
          if (img.width === 256 && img.height === 256) {
            uploadImageToServer(file);
          } else {
            setError(
              "Invalid logo. Please upload a PNG, JPG, or SVG file that is exactly 256x256 px"
            );
          }
        };

        img.onerror = () => {
          setError("Invalid image file. Please upload a valid image.");
        };
      };

      reader.onerror = (error) => {
        logger.error("Error reading file:", error);
        setError("Error reading file. Please try again.");
      };

      reader.readAsDataURL(file);
    }
  };

  const toBase64 = (json) => {
    return Buffer.from(JSON.stringify(json)).toString("base64");
  };

  const onSubmitClick = async () => {
    if (!config || !policy) return;

    setTxnCreated(true);
    setError(null);

    try {
      const deposit = policy?.proposal_bond || 0;
      const metadata = config.metadata || {};

      const description = {
        title: "Update Config - Theme & logo",
      };

      const updatedMetadata = {
        ...metadata,
        primaryColor: color,
        flagLogo: image,
      };

      const result = await signAndSendTransactions({
        transactions: [
          {
            receiverId: treasuryDaoID,
            signerId: accountId,
            actions: [
              {
                type: "FunctionCall",
                params: {
                  methodName: "add_proposal",
                  args: {
                    proposal: {
                      description: encodeToMarkdown(description),
                      kind: {
                        ChangeConfig: {
                          config: {
                            name: config.name,
                            purpose: config.purpose,
                            metadata: toBase64(updatedMetadata),
                          },
                        },
                      },
                    },
                  },
                  gas: 200000000000000,
                  deposit,
                },
              },
            ],
          },
        ],
      });

      if (result && result.length > 0 && result[0]?.status?.SuccessValue) {
        showToast("ProposalAdded", null, "settings");
        setTimeout(() => {
          setTxnCreated(false);
        }, REFRESH_DELAY);
      }
    } catch (error) {
      logger.error("Error submitting proposal:", error);
      showToast("ErrorAddingProposal", null, "settings");
      setTxnCreated(false);
    }
  };

  const cleanInputs = () => {
    // Reset form to saved values
    if (config) {
      const metadata = config.metadata;
      const defaultImage =
        metadata?.flagLogo ||
        "https://github.com/user-attachments/assets/244e15fc-3fb7-4067-a2c3-013e189e8d20";
      const defaultColor = metadata?.primaryColor || "#01BF7A";

      reset({
        image: defaultImage,
        color: defaultColor,
      });
    }
  };

  const handleCancel = () => {
    cleanInputs();
    setError(null);
  };

  const handleSave = () => {
    onSubmitClick();
  };

  return (
    <div style={{ maxWidth: "50rem" }}>
      <TransactionLoader showInProgress={isTxnCreated} />
      <div className="card rounded-4 py-3">
        <div className="card-title px-3 pb-3">Theme & Logo</div>
        {loadingConfig || !config ? (
          <div className="d-flex flex-column gap-3 px-3 py-1">
            <Skeleton className="w-100 rounded-3" style={{ height: "100px" }} />
            <Skeleton className="w-100 rounded-3" style={{ height: "50px" }} />
          </div>
        ) : (
          <div className="d-flex flex-column gap-4 px-3 py-1">
            <div className="d-flex gap-3 align-items-center flex-wrap flex-md-nowrap">
              <img
                src={
                  image ||
                  "https://github.com/user-attachments/assets/244e15fc-3fb7-4067-a2c3-013e189e8d20"
                }
                height={100}
                width={100}
                className="rounded-3"
                style={{ objectFit: "cover" }}
                alt="DAO Logo"
              />
              <div
                className="d-flex flex-column gap-2 flex-grow-1"
                style={{ maxWidth: "200px" }}
              >
                <label
                  htmlFor="imageUpload"
                  className="btn btn-outline-secondary w-100 cursor-pointer"
                >
                  <input
                    type="file"
                    id="imageUpload"
                    accept="image/png, image/jpeg, image/svg+xml"
                    onChange={handleImageChange}
                    disabled={!hasCreatePermission || uploadButtonDisabled}
                    style={{ display: "none" }}
                  />
                  {uploadingImage ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Uploading...
                    </>
                  ) : (
                    "Upload Logo"
                  )}
                </label>
                <div className="text-secondary text-center text-sm">
                  SVG, PNG, or JPG (256x256 px)
                </div>
              </div>
            </div>
            {error && (
              <div className="error-box p-3 rounded-3 d-flex gap-2 align-items-center">
                <i className="bi bi-exclamation-octagon h4 mb-0"></i>
                {error}
              </div>
            )}
            <div className="d-flex flex-column gap-1">
              <label className="form-label">Primary color</label>
              <div className="d-flex border border-1 align-items-center rounded-3 gap-2 p-1 px-2">
                <input
                  data-testid="color-picker-input"
                  type="color"
                  value={color}
                  onChange={(e) =>
                    setValue("color", e.target.value, { shouldDirty: true })
                  }
                  style={{
                    width: 35,
                    height: 30,
                    border: "none",
                    borderRadius: 5,
                    appearance: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                  disabled={!hasCreatePermission}
                />
                <input
                  data-testid="color-text-input"
                  type="text"
                  value={color}
                  onChange={(e) =>
                    setValue("color", e.target.value, { shouldDirty: true })
                  }
                  className="form-control border-0"
                  style={{ paddingInline: 0 }}
                  disabled={!hasCreatePermission}
                />
              </div>
            </div>
            <div className="d-flex mt-2 gap-3 justify-content-end">
              <button
                className="btn btn-outline-secondary shadow-none"
                onClick={handleCancel}
                disabled={!isDirty || !hasCreatePermission || isTxnCreated}
              >
                Cancel
              </button>
              {hasCreatePermission && (
                <InsufficientBannerModal
                  ActionButton={() => (
                    <button
                      className="btn theme-btn"
                      disabled={!isDirty || isTxnCreated}
                    >
                      Submit Request
                    </button>
                  )}
                  checkForDeposit={true}
                  callbackAction={handleSave}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Theme;
