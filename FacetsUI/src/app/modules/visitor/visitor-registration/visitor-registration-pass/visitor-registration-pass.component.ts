import { KeyValue } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChange, ViewChild, ViewChildren, inject } from '@angular/core';
import { FormBuilder, FormControlName, FormGroup, Validators } from '@angular/forms';
import { MatSelectChange } from '@angular/material/select';
import { Observable, fromEvent, merge } from 'rxjs';
import { appConstant } from 'src/app/core/extensions/app-constants';
import { ErrorResponse } from 'src/app/core/models/error-response.model';
import { ResponseResult } from 'src/app/core/models/response-result.model';
import { SearchRequestModel } from 'src/app/core/models/search-request.model';
import { LookupsService } from 'src/app/core/services/lookups.service';
import { ToasterService } from 'src/app/core/services/toaster.service';
import { EventDetailModel } from 'src/app/modules/event/models/event-detail.model';
import { PassCategoryModel } from 'src/app/modules/event/models/pass-category.model';
import { EventService } from 'src/app/modules/event/services/event.service';
import { PassCategoryService } from 'src/app/modules/event/services/pass-category.service';
import { GenericValidator } from 'src/app/shared/validators/forms-error-validator';
import { ValidationModel } from 'src/app/shared/validators/validation.model';
import { VisitorRegistrationService } from '../../services/visitor-registration.service';
import { VisitorRegisterModel } from '../../models/visitor-register.model';
import { SharedService } from 'src/app/core/services/shared.service';
import { convertOnlyDate } from 'src/app/core/extensions/helpers';
import { VisitorRegisterSummaryModel } from '../../models/visitor-register-summary.model';

@Component({
  selector: 'facets-visitor-registration-pass',
  templateUrl: './visitor-registration-pass.component.html',
  styleUrls: ['./visitor-registration-pass.component.scss']
})
export class VisitorRegistrationPassComponent implements OnInit, AfterViewInit {

  isBlocked = false;
  isFormSubmitted = false;
  isAllSelected = false;
  isDisable = false;
  isDatesShow = false;
  isDateDisable = false;
  isEdit = false;
  isFlatRate = false;
  isFlatRateEventDate: { startDate: string, endDate: string };
  amount = 0;
  totalAmount = 0;
  appliedDiscount = ''
  passCategories: KeyValue<string, string>[];
  checkedList = new Array<any>();
  unInvoicedCheckedList = new Array<any>();
  eventDates = new Array<any>();

  passForm: FormGroup;
  eventDetailModel = new EventDetailModel();
  visitorEventRegistrationModel: VisitorRegisterModel | undefined;
  passCategoryModel: PassCategoryModel;
  visitorRegisterSummaryModel: VisitorRegisterSummaryModel[];
  searchRequestModel = new SearchRequestModel(100, 1);
  validationModel: ValidationModel = new ValidationModel();

  lookupService = inject(LookupsService);
  toasterService = inject(ToasterService);
  formBuilder = inject(FormBuilder);
  eventService = inject(EventService);
  passCategoryService = inject(PassCategoryService);
  visitorRegistrationService = inject(VisitorRegistrationService);
  sharedService = inject(SharedService);

  @Input() visitorId: string;
  @Input() selectedPassCategories: string[];
  @Input() isUpdated: boolean = false;
  @Input() isPavilionSessionExist: boolean
  @Output() isPayment = new EventEmitter<string>();
  @Output() isAttachment = new EventEmitter<string>();
  @Output() sendVisitorRegistrationId = new EventEmitter<string>();
  @Output() sendFinalAmount = new EventEmitter<number>();
  @ViewChildren(FormControlName, { read: ElementRef }) formInputElements: ElementRef[];

  constructor() {
    this.validationModel.validationMessages = {
      passCategoryId: {
        required: 'Pass category is required',
      }
    };
    this.validationModel.formsErrorValidator = new GenericValidator(this.validationModel.validationMessages);
  }

  ngOnInit(): void {
    this.createPassForm();
    this.getPassCategories();
    this.getEventById(localStorage.getItem(appConstant.selectedEventId)!);
    this.getRegistrations();
  }

  ngAfterViewInit(): void {
    const controlBlurs: Observable<any>[] = this.formInputElements.map((formControl: ElementRef) => fromEvent(formControl.nativeElement, 'blur'));
    merge(this.passForm.valueChanges, ...controlBlurs).subscribe(() => {
      this.validate();
    });
  }

  validate(): void {
    this.validationModel.displayMessage = this.validationModel.formsErrorValidator.processMessages(this.passForm, this.isFormSubmitted);
  }

  createPassForm() {
    this.passForm = this.formBuilder.group({
      passCategoryId: ['', Validators.required],
      eventDateIds: ['', Validators.required]
    });
  }

  getEventById(eventId: string) {
    this.isBlocked = true;
    this.eventService.getById(eventId)
      .subscribe({
        next: (res: ResponseResult<EventDetailModel>) => {
          this.eventDetailModel = res.data;
          this.eventDetailModel.eventDates.map(m => this.eventDates.push({ key: m.key, value: m.value, isSelected: false, isInvoiced: false, isPassedDate: false }));

          if (!this.sharedService.isUpdatePass && this.sharedService.visitorRegistrationModel) {
            this.unInvoicedCheckedList = [];
            this.sharedService.visitorRegistrationModel.eventDateIds.forEach(eventDateId => {
              const eventDate = this.eventDetailModel.eventDates.find(f => f.key == eventDateId);
              this.checkedList.push(eventDate);
              this.eventDates.find(f => f.key == eventDateId).isSelected = true;
            });
            this.unInvoicedCheckedList.push(...this.eventDates.filter(f => f.isSelected == true && f.isInvoiced == false));
            this.passForm.controls.eventDateIds.patchValue(this.checkedList.map(m => m.key));
            if (this.checkedList.length === this.eventDates.map(m => m.key).length) this.isAllSelected = true;
            else this.isAllSelected = false;
            this.passForm.patchValue(this.sharedService.visitorRegistrationModel);
            this.getPassCategory(this.sharedService.visitorRegistrationModel.passCategoryId);
          }

          this.isBlocked = false;
        },
        error: (err: ErrorResponse) => {
          this.isBlocked = false;
          this.toasterService.error(err);
        }
      })
  }

  getPassCategories() {
    this.isBlocked = true;
    let passCategories: string[] = [];
    this.selectedPassCategories.forEach(selectedPassCategory => {
      passCategories.push(`&passCategoryType=${selectedPassCategory}`);
    });
    const queryString = passCategories.join('');
    this.lookupService.getPassCategories(this.searchRequestModel, localStorage.getItem(appConstant.selectedEventId)!, queryString).subscribe({
      next: (result: ResponseResult<KeyValue<string, string>[]>) => {
        this.isBlocked = false;
        this.passCategories = result.data;
      },
      error: (err: ErrorResponse) => {
        this.isBlocked = false;
        this.toasterService.error(err);
      }
    });
  }

  getRegistrations() {
    this.isBlocked = true;
    this.visitorRegistrationService.getRegistrations(this.searchRequestModel, this.visitorId, '').subscribe({
      next: (result: ResponseResult<VisitorRegisterSummaryModel[]>) => {
        this.isBlocked = false;
        this.visitorRegisterSummaryModel = result.data;
        if (this.visitorRegisterSummaryModel.length) {
          this.getVisitorRegistration();
        }
      },
      error: (err: ErrorResponse) => {
        this.isBlocked = false;
        this.toasterService.error(err);
      }
    });
  }

  getVisitorRegistration() {
    this.isBlocked = true;
    this.visitorRegistrationService.getVisitorRegistration(this.visitorId).subscribe({
      next: (result: ResponseResult<VisitorRegisterModel>) => {
        this.isBlocked = false;
        this.unInvoicedCheckedList = [];
        this.visitorEventRegistrationModel = result.data;
        this.sharedService.isUpdatePass = true;

        if (this.sharedService.visitorRegistrationModel) {
          this.sharedService.visitorRegistrationModel.eventDateIds.forEach(eventDateId => {
            const eventDate = this.eventDetailModel.eventDates.find(f => f.key == eventDateId);
            this.checkedList.push(eventDate);
            this.eventDates.find(f => f.key == eventDateId).isSelected = true;
          });
        }

        this.getVisitorEventRegistation();
      },
      error: (err: ErrorResponse) => {
        this.isBlocked = false;
        this.toasterService.error(err);
      }
    });
  }

  getVisitorEventRegistation() {
    this.visitorEventRegistrationModel!.visitorAttendanceSchedules.filter(f => f.isCancelled == false).forEach(attendance => {
      const eventDate = this.eventDetailModel.eventDates.find(f => f.key == attendance.eventDateId);
      this.checkedList.push(eventDate);
      this.eventDates.find(f => f.key == attendance.eventDateId).isSelected = true;
      this.eventDates.find(f => f.key == attendance.eventDateId).isInvoiced = attendance.isInvoiced;
      this.eventDates.find(f => f.key == attendance.eventDateId).isCancelled = attendance.isCancelled;
    });
    this.checkedList = [...new Set(this.checkedList)]
    this.unInvoicedCheckedList.push(...this.eventDates.filter(f => f.isSelected == true && f.isInvoiced == false));
    this.passForm.controls.eventDateIds.patchValue(this.checkedList.map(m => m.key));
    if (this.checkedList.length === this.eventDates.map(m => m.key).length) this.isAllSelected = true;
    else this.isAllSelected = false;
    this.passForm.patchValue(this.visitorEventRegistrationModel!);
    this.getPassCategory(this.visitorEventRegistrationModel!.passCategoryId);
    this.isDateDisable = this.eventDates.every(e => e.isInvoiced == true);


    if (this.visitorEventRegistrationModel && this.visitorEventRegistrationModel.rateType == 'FlatRate') {
      this.isDisable = true;
      this.passForm.get('passCategoryId')?.disable();

      // this.eventDates = this.eventDates.filter(f => f.isInvoiced == true);
    } else {
      this.isDisable = this.eventDates.every(e => e.isInvoiced == true);
    }

    const invoiced = this.eventDates.filter(e => e.isInvoiced == true);

    if (invoiced.length > 0)
      this.passForm.get('passCategoryId')?.disable();
  }

  get showMultiDayOffer(): boolean {
    const selectedId = this.passForm.get('passCategoryId')?.value;
    const selected = this.passCategories?.find(c => c.key === selectedId);
    return selected?.value?.trim().toLowerCase() === 'visitor';
  }

  onPassCategoryChange(event: MatSelectChange) {
    this.isDatesShow = false;
    this.getPassCategory(event.value);
  }

  getPassCategory(passCategoryId: string) {
    this.isBlocked = true;
    this.passCategoryService.getPassCategory(localStorage.getItem(appConstant.selectedEventId)!, passCategoryId).subscribe({
      next: (result: ResponseResult<PassCategoryModel>) => {
        this.isBlocked = false;
        this.isDatesShow = true;
        this.passCategoryModel = result.data;
        this.passDiscount();
        this.isDatesShow = true;
      },
      error: (err: ErrorResponse) => {
        this.isBlocked = false;
        this.toasterService.error(err);
      }
    })
  }

  checkUncheck(eventDate: any) {
    const passRate = this.passCategoryModel.passCategorySettings[0];
    if (passRate.rateType == 'FlatRate' && this.isDateDisable) {
      return;
    }

    const res = this.eventDates.find(p => p.key == eventDate.key)!;
    const isChecked = res.isSelected = !res.isSelected;

    if (isChecked) {
      this.checkedList.push(eventDate);
      this.unInvoicedCheckedList.push(eventDate);
      this.passForm.controls.eventDateIds.patchValue(this.checkedList.map(m => m.key));
      this.eventDates.find(f => f.key == eventDate.key).isSelected = true;
    }
    else {
      const index = this.checkedList.findIndex(f => f.key == eventDate.key);
      this.eventDates.find(f => f.key == eventDate.key).isSelected = false;
      const unInvoicedIndex = this.unInvoicedCheckedList.findIndex(f => f.key == eventDate.key);
      this.unInvoicedCheckedList.splice(unInvoicedIndex, 1);
      const checkedListIndex = this.checkedList.findIndex(f => f.key == eventDate.key);
      this.checkedList = this.checkedList.filter(f => f.key != eventDate.key)
      this.checkedList = [...new Set(this.checkedList)];
      // this.checkedList.splice(checkedListIndex, 1);
      this.passForm.controls.eventDateIds.patchValue(this.checkedList.map(m => m.key));
    }

    if (this.checkedList.length === this.eventDates.map(m => m.key).length) this.isAllSelected = true;
    else this.isAllSelected = false;

    this.passDiscount();
  }

  passDiscount() {
    const passRate = this.passCategoryModel.passCategorySettings[0];

    if (passRate.rateType == 'FlatRate') {
      this.isFlatRate = true;
    }
    else {
      this.isFlatRate = false;
      this.isFlatRateEventDate = { startDate: '', endDate: '' };
    }

    if (passRate.isChargeable) {
      if (!passRate.applyEntireEventDiscountedRate && !passRate.applyEarlyRegistrationDiscountedRate) {
        this.appliedDiscount = '';
        this.amount = passRate.rate;
      }

      if (passRate.applyEntireEventDiscountedRate) {
        if (this.unInvoicedCheckedList.length === this.eventDates.map(m => m.key).length) {
          this.appliedDiscount = 'All-Day pass discount';
          this.amount = passRate.discountedRate;
          return;
        }
        else {
          this.appliedDiscount = '';
          if (passRate.rateType == 'FlatRate') {
            this.amount = 0;
          }
          else {
            this.amount = passRate.rate;
          }
        }
      }

      if (passRate.applyEarlyRegistrationDiscountedRate) {
        const validUntilDate = convertOnlyDate(passRate.earlyRegistrationDiscountedRateValidUntil);
        const currentDate = convertOnlyDate(new Date());
        if (currentDate <= validUntilDate) {
          this.appliedDiscount = 'Early registration discount';
          this.amount = passRate.discountedRate;

          if (passRate.rateType == 'FlatRate') {
            if (this.eventDates.length > 1) {
              this.isFlatRateEventDate = { startDate: this.eventDates[0].value, endDate: this.eventDates[this.eventDates.length - 1].value };

            }
            else {
              this.isFlatRateEventDate = { startDate: this.eventDates[0].value, endDate: this.eventDates[0].value };
            }
          }
        }
        else {
          this.appliedDiscount = '';
          this.amount = passRate.rate;
        }
      }


      if (passRate.rateType == 'FlatRate') {

        this.isFlatRate = true;
        let currentDate = convertOnlyDate(new Date());

        this.eventDates = this.eventDates.map(dateString => {
          const eventDate = convertOnlyDate(dateString.value);
          dateString.isPassedDate = eventDate < currentDate;
          return dateString;
        });

        if (this.checkedList.length === this.eventDates.map(m => m.key).length) {
          if (this.eventDates.length > 1) {
            this.isFlatRateEventDate = { startDate: this.eventDates[0].value, endDate: this.eventDates[this.eventDates.length - 1].value };

          }
          else {
            this.isFlatRateEventDate = { startDate: this.eventDates[0].value, endDate: this.eventDates[0].value };
          }
          this.passForm.controls.eventDateIds.patchValue(this.checkedList.map(m => m.key));
          this.eventDates.map(e => e.isSelected = true);
          this.isAllSelected = true;
          this.isDateDisable = true;
          return;
        } else {
          const unInvoicedDates = this.eventDates.filter(f => f.isInvoiced == false).map(m => m.key);
          let eventDates = this.eventDetailModel.eventDates.filter(f => unInvoicedDates.includes(f.key));
          this.checkedList = [];
          this.unInvoicedCheckedList = [];
          this.checkedList.push(...eventDates);

          if (this.eventDates.length > 1) {
            this.isFlatRateEventDate = { startDate: eventDates[0].value, endDate: eventDates[eventDates.length - 1].value };

          }
          else {
            this.isFlatRateEventDate = { startDate: eventDates[0].value, endDate: eventDates[0].value };
          }

          // this.isFlatRateEventDate = { startDate: eventDates[0].value, endDate: eventDates[eventDates.length - 1].value };
          this.unInvoicedCheckedList.push(...eventDates);
          this.passForm.controls.eventDateIds.patchValue(this.checkedList.map(m => m.key));
          this.eventDates.map(e => e.isSelected = true);
          this.isAllSelected = true;
          this.isDateDisable = true;
        }
      }
    }
    else this.amount = 0;
  }

  isAllChecked() {
    const isChecked = this.isAllSelected = !this.isAllSelected;
    const unInvoicedDates = this.eventDates.filter(f => f.isInvoiced == false).map(m => m.key);
    if (isChecked) {
      this.checkedList = [];
      this.unInvoicedCheckedList = [];
      const eventDates = this.eventDetailModel.eventDates.filter(f => unInvoicedDates.includes(f.key));
      this.checkedList.push(...eventDates);
      this.unInvoicedCheckedList.push(...eventDates);
      this.passForm.controls.eventDateIds.patchValue(this.checkedList.map(m => m.key));
      this.eventDates.map(e => e.isSelected = true);
      this.isAllSelected = true;
    }
    else {
      this.checkedList = [];
      this.unInvoicedCheckedList = [];
      const eventDates = this.eventDetailModel.eventDates.filter(f => !unInvoicedDates.includes(f.key));
      this.checkedList.push(...eventDates);
      this.passForm.controls.eventDateIds.patchValue(this.checkedList.map(m => m.key));
      this.eventDates.filter(f => unInvoicedDates.includes(f.key)).map(e => e.isSelected = false);
      this.isAllSelected = false;
    }

    this.passDiscount();
  }

  createPass() {
    this.isFormSubmitted = true;
    this.validate();

    // if (this.unInvoicedCheckedList!.length === 0) { return this.toasterService.warning('Please select event dates') }
    if (this.passForm.invalid) {
      if ((this.passForm.value.passCategoryId != undefined && this.passForm.value.passCategoryId != "") && this.unInvoicedCheckedList!.length === 0) {
        return this.toasterService.warning('Please select event dates');
      }
      else {
        return;
      }
    }

    const passRate = this.passCategoryModel.passCategorySettings[0];

    this.passForm.controls.eventDateIds.patchValue(this.checkedList.map(m => m.key));

    this.isBlocked = true;
    this.visitorEventRegistrationModel = Object.assign({}, this.visitorEventRegistrationModel, this.passForm.value);
    this.visitorEventRegistrationModel!.visitorId = this.visitorId;

    this.isPayment.emit(this.visitorId);

    this.visitorEventRegistrationModel!.rateType = passRate.rateType == 'FlatRate' ? passRate.rateType = 'FlatRate' : passRate.rateType = 'PerDayRate';
    if (passRate.rateType == 'FlatRate') {
      this.sendFinalAmount.emit(this.amount);
    } else {
      this.sendFinalAmount.emit(this.amount * this.visitorEventRegistrationModel!.eventDateIds.length);
    }

    this.sharedService.visitorRegistrationModel = this.visitorEventRegistrationModel;
    this.sharedService.visitorRegistrationModel!.allEventDateIds = this.checkedList.map(m => m.key);
    this.sharedService.isUpdatePass = false;
  }

  updatePass() {
    this.isFormSubmitted = true;
    this.validate();

    // if (this.unInvoicedCheckedList!.length === 0) { return this.toasterService.warning('Please select event dates') }
    if (this.passForm.invalid) {
      if ((this.passForm.value.passCategoryId != undefined && this.passForm.value.passCategoryId != "") && this.unInvoicedCheckedList!.length === 0) {
        return this.toasterService.warning('Please select event dates');
      }
      else {
        return;
      }
    }

    const passRate = this.passCategoryModel.passCategorySettings[0];

    this.isBlocked = true;
    this.visitorEventRegistrationModel = Object.assign({}, this.visitorEventRegistrationModel, this.passForm.value);
    this.visitorEventRegistrationModel!.visitorId = this.visitorId;

    const unInvoicedEventDateIds = this.eventDates.filter(f => f.isInvoiced == false).map(m => m.key);
    this.visitorEventRegistrationModel!.eventDateIds = this.visitorEventRegistrationModel!.eventDateIds.filter(value => unInvoicedEventDateIds.includes(value));

    this.isPayment.emit(this.visitorId);

    this.visitorEventRegistrationModel!.rateType = passRate.rateType == 'FlatRate' ? passRate.rateType = 'FlatRate' : passRate.rateType = 'PerDayRate';
    this.visitorEventRegistrationModel!.eventDateIds = [...new Set(this.visitorEventRegistrationModel!.eventDateIds)]

    this.visitorEventRegistrationModel!.rateType = passRate.rateType == 'FlatRate' ? passRate.rateType = 'FlatRate' : passRate.rateType = 'PerDayRate';
    if (passRate.rateType == 'FlatRate') {
      this.sendFinalAmount.emit(this.amount);
    } else {
      this.sendFinalAmount.emit(this.amount * this.visitorEventRegistrationModel!.eventDateIds.length);
    }

    this.sharedService.visitorRegistrationModel = this.visitorEventRegistrationModel;
    this.sharedService.visitorRegistrationModel!.allEventDateIds = this.checkedList.map(m => m.key);
  }

  back() {
    this.isAttachment.emit(this.visitorId);
  }

  savePass() {
    if (this.visitorEventRegistrationModel == undefined) {
      this.createPass();
    }
    else {
      this.updatePass();
    }
  }
}
