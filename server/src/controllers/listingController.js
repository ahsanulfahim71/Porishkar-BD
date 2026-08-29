import Listing from "../models/Listing.js";
import cloudinary from "../config/cloudinary.js";
import { awardPoints } from "../services/ecoPointsService.js";

// Create a new recyclable material listing
export const createListing = async (req, res) => {
  try {
    const {
      title,
      description,
      materialType,
      quantityValue,
      quantityUnit,
      condition,
      listingType,
      askingPrice,
      fullAddress,
      district,
      division,
    } = req.body;

    if (
      !title ||
      !materialType ||
      !quantityValue ||
      !quantityUnit ||
      !condition ||
      !listingType ||
      !fullAddress ||
      !district ||
      !division
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    if (
      listingType === "Sale" &&
      (askingPrice === undefined || askingPrice === "")
    ) {
      return res.status(400).json({
        success: false,
        message: "Asking price is required for sale listings",
      });
    }

    // Uploaded Cloudinary images
    const images = (req.files || []).map((file) => ({
      url: file.path,
      publicId: file.filename,
    }));

    const listing = await Listing.create({
      seller: req.user._id,

      title,
      description,
      materialType,

      quantity: {
        value: Number(quantityValue),
        unit: quantityUnit,
      },

      condition,
      listingType,

      askingPrice:
        listingType === "Donation"
          ? null
          : Number(askingPrice),

      pickupAddress: {
        fullAddress,
        district,
        division,
      },

      images,

      status: "Active",
    });

    return res.status(201).json({
      success: true,
      message: "Listing created successfully",
      listing,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create listing",
      error: error.message,
    });
  }
};

// Get all active marketplace listings
export const getAllListings = async (req, res) => {
  try {
    const listings = await Listing.find({
      status: "Active",
    })
      .populate("seller", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: listings.length,
      listings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to get listings",
      error: error.message,
    });
  }
};

// Get one listing by ID
export const getListingById = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id).populate(
      "seller",
      "name email"
    );

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    return res.status(200).json({
      success: true,
      listing,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to get listing",
      error: error.message,
    });
  }
};

// Get listings created by logged-in user
export const getMyListings = async (req, res) => {
  try {
    const listings = await Listing.find({
      seller: req.user._id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: listings.length,
      listings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to get your listings",
      error: error.message,
    });
  }
};

// Update a listing
export const updateListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    // Only owner can update
    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to edit this listing",
      });
    }

    const {
      title,
      description,
      materialType,
      quantityValue,
      quantityUnit,
      condition,
      listingType,
      askingPrice,
      fullAddress,
      district,
      division,
      removeImages,
    } = req.body;

    // -----------------------------
    // Remove selected old images
    // -----------------------------

    let imagesToRemove = [];

    if (removeImages) {
      imagesToRemove = Array.isArray(removeImages)
        ? removeImages
        : [removeImages];
    }

    if (imagesToRemove.length > 0) {
      await Promise.all(
        imagesToRemove.map((publicId) =>
          cloudinary.uploader.destroy(publicId)
        )
      );

      listing.images = listing.images.filter(
        (image) => !imagesToRemove.includes(image.publicId)
      );
    }

    // -----------------------------
    // New uploaded images
    // -----------------------------

    const newImages = (req.files || []).map((file) => ({
      url: file.path,
      publicId: file.filename,
    }));

    // Maximum total 4 images
    if (listing.images.length + newImages.length > 4) {
      // Remove newly uploaded images from Cloudinary
      await Promise.all(
        newImages.map((image) =>
          cloudinary.uploader.destroy(image.publicId)
        )
      );

      return res.status(400).json({
        success: false,
        message: "A listing can have a maximum of 4 images",
      });
    }

    listing.images = [
      ...listing.images,
      ...newImages,
    ];

    // -----------------------------
    // Update normal listing data
    // -----------------------------

    listing.title = title;
    listing.description = description;
    listing.materialType = materialType;

    listing.quantity = {
      value: Number(quantityValue),
      unit: quantityUnit,
    };

    listing.condition = condition;
    listing.listingType = listingType;

    listing.askingPrice =
      listingType === "Donation"
        ? null
        : Number(askingPrice);

    listing.pickupAddress = {
      fullAddress,
      district,
      division,
    };

    const updatedListing = await listing.save();

    return res.status(200).json({
      success: true,
      message: "Listing updated successfully",
      listing: updatedListing,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update listing",
      error: error.message,
    });
  }
};

// Mark a listing as sold — only the seller can do this, and only for their
// own Active listings. Awards eco points to the seller.
export const markListingSold = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "You are not allowed to update this listing" });
    }

    if (listing.status !== "Active") {
      return res.status(400).json({
        success: false,
        message: `Cannot mark a listing with status "${listing.status}" as sold`,
      });
    }

    listing.status = "Sold";
    await listing.save();

    let ecoPointsResult = null;
    try {
      ecoPointsResult = await awardPoints(req.user._id, "sell_recyclables");
    } catch (pointsError) {
      console.error("Eco points award failed:", pointsError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Listing marked as sold",
      listing,
      ecoPoints: ecoPointsResult
        ? { pointsEarned: ecoPointsResult.activity.points, newBalance: ecoPointsResult.newBalance }
        : null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to mark listing as sold",
      error: error.message,
    });
  }
};

// Delete a listing
export const deleteListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    // Only owner can delete
    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this listing",
      });
    }

    // Delete images from Cloudinary
    if (listing.images && listing.images.length > 0) {
      await Promise.all(
        listing.images.map((image) => {
          if (image.publicId) {
            return cloudinary.uploader.destroy(image.publicId);
          }

          return Promise.resolve();
        })
      );
    }

    
    // Delete listing from MongoDB
    await Listing.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Listing and images deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete listing",
      error: error.message,
    });
  }
};