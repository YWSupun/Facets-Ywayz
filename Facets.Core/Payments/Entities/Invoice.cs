using Facets.Core.Counters.Entities;
using Facets.Core.Participants.Entities;
using Facets.Core.Payments.Events;
using Facets.SharedKernal.Exceptions;
using Facets.SharedKernal.Helpers;
using Facets.SharedKernal.Interfaces;
using Facets.SharedKernal.Models;
using static Facets.SharedKernal.AppEnums;

namespace Facets.Core.Payments.Entities;

public sealed class Invoice : EntityBase, ICreatedAudit, IUpdatedAudit, IDeletedAudit
{
    // Maximum invoice total: the multi-day pass price (matches the 5000 cap in the public payment UI).
    private const decimal MultiDayMaxAmount = 5000m;

    public DateTimeOffset CreatedOn { get; set; }
    public string? CreatedBy { get; set; }
    public DateTimeOffset? UpdatedOn { get; set; }
    public string? UpdatedBy { get; set; }
    public DateTimeOffset? DeletedOn { get; set; }
    public string? DeletedBy { get; set; }
    public bool IsDeleted { get; private set; }

    public Guid VisitorRegistrationId { get; private set; }
    public VisitorRegistration VisitorRegistration { get; private set; } = null!;

    public Guid VisitorId { get; private set; }
    public Guid EventId { get; private set; }

    public decimal TotalAmount { get; private set; }

    public bool InvoiceCancelled { get; private set; }
    public DateTimeOffset? InvoiceCancelledOn { get; private set; }

    private readonly List<InvoiceLineItem> _invoiceLineItems = new();
    public IReadOnlyCollection<InvoiceLineItem> InvoiceLineItems => _invoiceLineItems.AsReadOnly();


    private readonly List<Payment> _payments = new();
    public IReadOnlyCollection<Payment> Payments => _payments.AsReadOnly();

    public Guid PassCategoryId { get; private set; }
    public Guid PassCategorySettingId { get; private set; }
    public DiscountType AppliedDiscountType { get; private set; }
    public bool PassCategorySetToChargable { get; private set; }
    public PaymentStatus PaymentStatus { get; private set; }
    public DateTimeOffset? PaidOn { get; private set; }
    public Guid? RegistrationCounterId { get; private set; }
    public VisitorRegistrationCounter VisitorRegistrationCounter { get; private set; } = null!;
    public bool InvoicedOnSite { get; private set; }
    public RateType RateType { get; set; }
    public string ReferenceNumber { get; private set; }

    private Invoice() { }

    public Invoice(Guid visitorRegistrationId,
                   Guid visitorId,
                   Guid eventId,
                   Guid passCategoryId,
                   Guid passCategorySettingId,
                   DiscountType appliedDiscountType,
                   bool passCategorySetToChargable,
                   Guid? registrationCounterId,
                   bool invoicedOnSite,
                   RateType rateType,
                   IEnumerable<InvoiceLineItem> invoiceLineItems)
    {

        if (invoiceLineItems.Any() is false) throw new OperationFailedException("Invoice", "No line items to create an invoice");

        ReferenceNumber = OnePayHelper.GenerateReferenceNumber();
        VisitorRegistrationId = visitorRegistrationId;
        VisitorId = visitorId;
        EventId = eventId;
        PassCategoryId = passCategoryId;
        PassCategorySettingId = passCategorySettingId;
        AppliedDiscountType = appliedDiscountType;
        PassCategorySetToChargable = passCategorySetToChargable;
        RegistrationCounterId = registrationCounterId;
        InvoicedOnSite = invoicedOnSite;
        RateType = rateType;

        SetLineItems(invoiceLineItems);

        TotalAmount = Math.Min(_invoiceLineItems.Sum(s => s.Amount), MultiDayMaxAmount);

        PaymentStatus = TotalAmount is 0 ? PaymentStatus.Free : PaymentStatus.Unpaid;
    }

    private void SetLineItems(IEnumerable<InvoiceLineItem> invoiceLineItems)
    {
        List<InvoiceLineItem> finalizedLineItems = new();

        finalizedLineItems.AddRange(invoiceLineItems.Where(w => w.LineItemType is not InvoiceLineItemType.VisitorEventAttendance).ToList());

        var eventDateLineItems = invoiceLineItems.Where(w => w.LineItemType is InvoiceLineItemType.VisitorEventAttendance).ToList();

        if (RateType == RateType.FlatRate && eventDateLineItems.Any())
        {
            var firsEventDatetLineItem = eventDateLineItems.First();

            finalizedLineItems.Add(firsEventDatetLineItem);

            eventDateLineItems.Remove(firsEventDatetLineItem);

            foreach (var item in eventDateLineItems)
            {
                finalizedLineItems.Add(new(item.ItemId, 0M, item.LineItemType));
            }
        }

        else if (RateType == RateType.PerDayRate)
        {
            finalizedLineItems.AddRange(eventDateLineItems);
        }

        foreach (var invoiceLineItem in finalizedLineItems)
        {
            _invoiceLineItems.Add(new(invoiceLineItem.ItemId, invoiceLineItem.Amount, invoiceLineItem.LineItemType));
        }
    }

    internal void MarkAsPaid()
    {
        RegisterDomainEvent(new VisitorInvoicingEventEvent(this));

        if (PassCategorySetToChargable is false) return;

        if (PaymentStatus is PaymentStatus.Paid) throw new OperationFailedException("Invoice", $"Invoice id ({Id}) is already paid");

        PaymentStatus = PaymentStatus.Paid;
        PaidOn = DateTimeOffset.UtcNow;
    }

    internal void CancelInvoice()
    {
        InvoiceCancelled = true;
        InvoiceCancelledOn = DateTimeOffset.UtcNow;

        foreach (var lineItem in _invoiceLineItems)
        {
            lineItem.Deleted();
        }
    }
}
