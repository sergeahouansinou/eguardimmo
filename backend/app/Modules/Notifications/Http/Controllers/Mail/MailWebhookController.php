<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Mail;

use App\Modules\Notifications\Actions\RecordMailEvents;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Http\Resources\MailWebhookResultResource;
use App\Modules\Notifications\Support\MailProvider;
use App\Modules\Notifications\Support\MailWebhookSignature;
use Illuminate\Http\Request;

final class MailWebhookController
{
    public function __invoke(Request $request, MailWebhookSignature $signature, RecordMailEvents $action): MailWebhookResultResource
    {
        $corps = $request->getContent();

        if (! $signature->valid(MailProvider::MAILTRAP, $corps, $request->header('Mailtrap-Signature'))) {
            throw ErrorCode::MailWebhookUnauthorized->problem();
        }

        $charge = json_decode($corps, true);
        $evenements = is_array($charge) && is_array($charge['events'] ?? null) && array_is_list($charge['events']) ? $charge['events'] : null;

        if ($evenements === null) {
            throw ErrorCode::MailWebhookPayloadInvalid->problem();
        }

        return new MailWebhookResultResource($action->handle(MailProvider::MAILTRAP, $evenements));
    }
}
