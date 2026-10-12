using Facets.Api.Policies;
using Facets.Core.Events.DTOs;
using Facets.Core.Events.Interfaces;
using Facets.Core.Security.AuthPolicies;
using Facets.SharedKernal.Responses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Facets.Api.Controllers.V1.Events;

[Route("api/events/{eventId}/settings")]
public sealed class EventSettingsController : AdminAppControllerBase
{
    private readonly IEventSettingsService _eventSettingsService;

    public EventSettingsController(IEventSettingsService eventSettingsService)
    {
        _eventSettingsService = eventSettingsService;
    }

    [HttpPut("update-payment-settings")]
    [Authorize(policy: ApplicationAuthPolicy.PaymentSettingPolicy.PaymentSettingsUpdate)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult> UpdatePaymentSettings([FromRoute] Guid eventId, [FromBody] UpdatePaymentSettingsDto model)
    {
        var response = await _eventSettingsService.UpdatePaymentSettings(eventId, model, CancellationToken.None);

        return response.Success ? NoContent() : UnsuccessfullResponse(response);
    }

    [HttpGet("payment-settings")]
    [AllowPublicSiteUser]
    [ProducesResponseType(typeof(ResponseResult<PaymentSettingsDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult> GetPaymentSetting([FromRoute] Guid eventId, CancellationToken token)
    {
        var response = await _eventSettingsService.GetPaymentSetting(eventId, token);

        return response.Success ? Ok(response) : UnsuccessfullResponse(response);
    }
}
