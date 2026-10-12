using Facets.Core.Common;
using Facets.Core.Common.Dtos;
using Facets.Core.Common.Interfaces;
using Facets.Core.Events.Interfaces;
using Facets.Core.Passes.Interfaces;
using Facets.Core.Payments.Events;
using Facets.Core.Visitors.Interfaces;
using Facets.SharedKernal;
using Facets.SharedKernal.Extensions;
using Facets.SharedKernal.Helpers;
using Facets.SharedKernal.Responses;
using MediatR;
using Net.Codecrete.QrCodeGenerator;
using System.Text;

namespace Facets.Core.Payments.EventHandlers;

internal sealed class VisitorRegistrationCompleteMessageSendingEventHandler : INotificationHandler<VisitorInvoicingEventEvent>
{
    private readonly IVisitorService _visitorService;
    private readonly IEventService _eventService;
    private readonly ISMSService _smsService;
    private readonly IEmailService _emailService;
    private readonly IPassCategoryService _passCategoryService;

    public VisitorRegistrationCompleteMessageSendingEventHandler(IVisitorService visitorService, IEventService eventService, ISMSService smsService, IEmailService emailService, IPassCategoryService passCategoryService)
    {
        _visitorService = visitorService;
        _eventService = eventService;
        _smsService = smsService;
        _emailService = emailService;
        _passCategoryService = passCategoryService;
    }

    public async Task Handle(VisitorInvoicingEventEvent notification, CancellationToken cancellationToken)
    {
        var eventRespone = await _eventService.GetEventById(notification.VisitorRegistration.EventId, cancellationToken);

        var assignedEventDateIds = notification.VisitorRegistration.VisitorAttendanceSchedules.Select(s => s.EventDateId);

        var eventDates = eventRespone.Data!.EventDates
                                           .Where(w => assignedEventDateIds.Contains(w.Key))
                                           .Select(s => s.Value)
                                           .OrderBy(o => o);

        var localDates = eventDates.Select(s => s.GetLocalTime(AppConstants.SriLankaTimeZone).ToApplicationDateFormat()).ToList();

        if (localDates.Count is 0) return;

        string commaDelimeteredDates = string.Join(", ", localDates);

        var visitorResponse = await _visitorService.GetVisitorById(notification.VisitorRegistration.VisitorId, cancellationToken);

        var visitor = visitorResponse.Data!;
        bool isSriLankanNumber = MobileNumberHelper.IsSriLankaNumber(visitor.MobileNumber);

        string sendTo = isSriLankanNumber ? visitor.MobileNumber! : visitor.Email!;

        // JSON data to be encoded into the QR code
        var attendanceSheduleIds = notification.VisitorRegistration.VisitorAttendanceSchedules.Select(s=>s.Id).ToList();
        var visitorId = visitor.Id;
        var scheduleList = "";

        List<byte[]> svgBytesList = new List<byte[]>();
        // Create the JSON string with dynamic values
        foreach (var attendanceSheduleId in attendanceSheduleIds)
        {
            scheduleList += attendanceSheduleId + ",";
        }

        string json = $"{{\"attendanceSheduleId\":\"{scheduleList}\",\"visitorId\":\"{visitorId}\",\"type\":\"visitor\"}}";
        // Generate the QR code
        var qr = QrCode.EncodeText(json, QrCode.Ecc.Medium);
        string svg = qr.ToSvgString(4);
        byte[] svgBytes = Encoding.UTF8.GetBytes(svg);

        // Add to list
        svgBytesList.Add(svgBytes);



        // Convert SVG string to byte array 
        await SendEventRegistrationCompletedMessage();

        async Task<ResponseResult> SendEventRegistrationCompletedMessage()
        {
            if (isSriLankanNumber is false)
            {
                string template = await _emailService.GetEmailTemplate("VisitorRegistrationSuccessEmailTemplate.html");

                var passCategoryResponse = await _passCategoryService.GetPassCategoryById(notification.VisitorRegistration.EventId,
                                                                                          notification.VisitorRegistration.PassCategoryId,
                                                                                          cancellationToken);

                bool isForeignBuyer = passCategoryResponse.Success
                                      && string.Equals(passCategoryResponse.Data!.Name?.Trim(), "Foreign - Buyer", StringComparison.OrdinalIgnoreCase);
                
                await _emailService.SendEmailByQueue(EmailBuilder.BuildEventRegistrationCompletedMessage(
                                                                                  sendTo,
                                                                                  eventName: eventRespone.Data.Name,
                                                                                  visitorFirstName: visitor.FirstName,
                                                                                  visitorLastName: visitor.LastName,
                                                                                  visitorReference: visitor.VisitorReference,
                                                                                  visitorIdentityType: visitor.VisitorIdentityType,
                                                                                  identificationNumber: visitor.NICNumber ?? visitor.PassportNumber!,
                                                                                  commaDelimeteredDates: commaDelimeteredDates,
                template, svgBytesList, includeForeignBuyerInfo: isForeignBuyer));
                return new();
            }

            else
            {
                await _smsService
                .SendSMSByQueue(SMSMessage.BuildEventRegistrationCompletedMessage(mobileNumber: visitor.MobileNumber,
                                                                                  eventName: eventRespone.Data.Name,
                                                                                  visitorFirstName: visitor.FirstName,
                                                                                  visitorLastName: visitor.LastName,
                                                                                  visitorReference: visitor.VisitorReference,
                                                                                  visitorIdentityType: visitor.VisitorIdentityType,
                                                                                  identificationNumber: visitor.NICNumber ?? visitor.PassportNumber!,
                                                                                  commaDelimeteredDates: commaDelimeteredDates));
                return new();
            }
        }

    }
}
