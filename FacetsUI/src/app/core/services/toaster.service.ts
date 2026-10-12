import { Injectable } from "@angular/core";
import { ToastrService } from "ngx-toastr";
import { ErrorResponse } from "../models/error-response.model";

@Injectable({
    providedIn: 'root'
})
export class ToasterService {

    constructor(private toaster: ToastrService) { }

    public success(message: string, title: string = 'Success') {
        this.toaster.success(message, title);
    }

    public error(error: ErrorResponse, title: string = 'Error') {
        if (!error?.errors?.length) {
            this.toaster.error('Something went wrong. Please try again.', title);
            return;
        }

        error.errors.forEach(element => {
            if (element.value[0] != undefined)
                this.toaster.error(element.value[0], element.key.replace(/([a-z0-9])([A-Z])/g, '$1 $2'));
        });
    }

    public warning(message: string, title: string = 'Warning') {
        this.toaster.warning(message, title);
    }

    public info(message: string, title: string = 'Info') {
        this.toaster.info(message, title);
    }

    public successfullyCreated(message: string) {
        this.success(`${message} created successfully!`);
    }

    public successfullyUpdated(message: string) {
        this.success(`${message} updated successfully!`);
    }

    public successfullyDeleted(message: string) {
        this.success(`${message} deleted successfully!`);
    }

    public errorSaving(error: ErrorResponse) {
        this.error(error);
    }

    public errorUpdating(error: ErrorResponse) {
        this.error(error);
    }

    public errorLoading(error: ErrorResponse) {
        this.error(error);
    }

    public errorDeleting(error: ErrorResponse) {
        this.error(error);
    }
}
