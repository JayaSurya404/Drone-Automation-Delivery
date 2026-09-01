import type { AddressRepository } from "./address.repository.js";
import type {
  AuthenticatedUser,
  CustomerAddressResponse,
  CreateCustomerAddressRequest,
  UpdateCustomerAddressRequest
} from "@skynav/contracts";
import { AuthError } from "../auth/auth.service.js";

export interface AddressService {
  listAddresses(user: AuthenticatedUser): Promise<CustomerAddressResponse[]>;
  getAddress(user: AuthenticatedUser, id: string): Promise<CustomerAddressResponse>;
  createAddress(user: AuthenticatedUser, input: CreateCustomerAddressRequest): Promise<CustomerAddressResponse>;
  updateAddress(user: AuthenticatedUser, id: string, input: UpdateCustomerAddressRequest): Promise<CustomerAddressResponse>;
  deleteAddress(user: AuthenticatedUser, id: string): Promise<void>;
}

export function createAddressService(repo: AddressRepository): AddressService {
  function mapAddress(r: any): CustomerAddressResponse {
    return {
      id: r.id,
      userId: r.user_id,
      recipientName: r.recipient_name,
      phone: r.phone,
      addressLine1: r.address_line1,
      addressLine2: r.address_line2,
      city: r.city,
      state: r.state,
      postalCode: r.postal_code,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      deliveryInstructions: r.delivery_instructions,
      isDefault: Boolean(r.is_default),
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at)
    };
  }

  return {
    async listAddresses(user) {
      const rows = await repo.list(user.id);
      return rows.map(mapAddress);
    },

    async getAddress(user, id) {
      const row = await repo.findById(user.id, id);
      if (!row) {
        throw new AuthError(404, "ADDRESS_NOT_FOUND", "Delivery address not found.");
      }
      return mapAddress(row);
    },

    async createAddress(user, input) {
      const row = await repo.create(user.id, {
        recipient_name: input.recipientName,
        phone: input.phone,
        address_line1: input.addressLine1,
        address_line2: input.addressLine2,
        city: input.city,
        state: input.state,
        postal_code: input.postalCode,
        latitude: input.latitude,
        longitude: input.longitude,
        delivery_instructions: input.deliveryInstructions,
        is_default: input.isDefault
      });
      return mapAddress(row);
    },

    async updateAddress(user, id, input) {
      const updateData: any = {};
      if (input.recipientName !== undefined) updateData.recipient_name = input.recipientName;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.addressLine1 !== undefined) updateData.address_line1 = input.addressLine1;
      if (input.addressLine2 !== undefined) updateData.address_line2 = input.addressLine2;
      if (input.city !== undefined) updateData.city = input.city;
      if (input.state !== undefined) updateData.state = input.state;
      if (input.postalCode !== undefined) updateData.postal_code = input.postalCode;
      if (input.latitude !== undefined) updateData.latitude = input.latitude;
      if (input.longitude !== undefined) updateData.longitude = input.longitude;
      if (input.deliveryInstructions !== undefined) updateData.delivery_instructions = input.deliveryInstructions;
      if (input.isDefault !== undefined) updateData.is_default = input.isDefault;

      const row = await repo.update(user.id, id, updateData);
      if (!row) {
        throw new AuthError(404, "ADDRESS_NOT_FOUND", "Delivery address not found.");
      }
      return mapAddress(row);
    },

    async deleteAddress(user, id) {
      const deleted = await repo.delete(user.id, id);
      if (!deleted) {
        throw new AuthError(404, "ADDRESS_NOT_FOUND", "Delivery address not found.");
      }
    }
  };
}
