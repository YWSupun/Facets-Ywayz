using Facets.Core.Common.Dtos;
using System.Data.SqlTypes;
using System.Net.Mail;
using System.Text;
using static Facets.SharedKernal.AppEnums;

namespace Facets.Core.Common;

public sealed class EmailBuilder
{
    public static EmailModel BuildOTP(string toEmailAddress, string code, string template)
    {
        StringBuilder emailBody = new(template);

        emailBody.Replace("#otp_code#", code);

        EmailModel email = new()
        {
            To = toEmailAddress,
            Subject = "Facets OTP",
            Body = emailBody.ToString(),
        };

        return email;
    }

    public static EmailModel BuildEventRegistrationCompletedMessage(string toEmailAddress,
                                                                    string eventName,
                                                                    string visitorFirstName,
                                                                    string visitorLastName,
                                                                    string visitorReference,
                                                                    VisitorIdentityType visitorIdentityType,
                                                                    string identificationNumber,
                                                                    string commaDelimeteredDates,
                                                                    string template, List<byte[]> svgBytesList,
                                                                    bool includeForeignBuyerInfo = false)
    {
        StringBuilder emailBody = new(RenderForeignBuyerSection(template, includeForeignBuyerInfo));

        emailBody
        .Replace("#event_name#", eventName)
        .Replace("#visitor_reference#", visitorReference)
        .Replace("#visitor_first_name#", visitorFirstName)
        .Replace("#visitor_last_name#", visitorLastName)
        .Replace("#visitor_identity_type#", visitorIdentityType.ToString())
        .Replace("#identification_number#", identificationNumber)
        .Replace("#comma_delimetered_dates#", commaDelimeteredDates)
        // Hotel is the event venue; tour wording is temporary until it is provided
        .Replace("#hotel_details#", "Cinnamon Life at City of Dreams")
        .Replace("#tour_details#", "To be announced");

        EmailModel email = new()
        {
            To = toEmailAddress,
            Subject = "Facets Sri Lanka - Event Registration Details",
            Body = emailBody.ToString(),
        };
        // Add the SVG attachment
        if (svgBytesList != null && svgBytesList.Count > 0)
        {
            for (int i = 0; i < svgBytesList.Count; i++)
            {
                // Generate a unique filename for each attachment
                string fileName = $"event-qr-{i + 1}.svg";
                email.Attachments.Add(new EmailAttachment
                {
                    FileName = fileName,
                    Content = svgBytesList[i],
                    ContentType = "image/svg+xml"
                });
            }
        }

        return email;
    }

    private static string RenderForeignBuyerSection(string template, bool include)
    {
        const string startMarker = "<!--FOREIGN_BUYER_START-->";
        const string endMarker = "<!--FOREIGN_BUYER_END-->";

        int start = template.IndexOf(startMarker, StringComparison.Ordinal);
        int end = template.IndexOf(endMarker, StringComparison.Ordinal);

        if (start < 0 || end < start) return template;

        if (include)
            return template.Remove(end, endMarker.Length).Remove(start, startMarker.Length);

        return template.Remove(start, end + endMarker.Length - start);
    }

    public static EmailModel BuildCancellationEmailMessage(string toEmailAddress,
                                                                   string eventName,
                                                                   string visitorFirstName,
                                                                   string visitorLastName,
                                                                   string visitorReference,
                                                                   VisitorIdentityType visitorIdentityType,
                                                                   string identificationNumber,
                                                                   string commaDelimeteredDates,
                                                                   string template)
    {
        StringBuilder emailBody = new(template);

        emailBody
        .Replace("#event_name#", eventName)
        .Replace("#visitor_reference#", visitorReference)
        .Replace("#visitor_first_name#", visitorFirstName)
        .Replace("#visitor_last_name#", visitorLastName)
        .Replace("#visitor_identity_type#", visitorIdentityType.ToString())
        .Replace("#identification_number#", identificationNumber)
        .Replace("#comma_delimetered_dates#", commaDelimeteredDates);

        EmailModel email = new()
        {
            To = toEmailAddress,
            Subject = "Facets Sri Lanka - Event Registration Details",
            Body = emailBody.ToString(),
        };
        return email;
    }
}
