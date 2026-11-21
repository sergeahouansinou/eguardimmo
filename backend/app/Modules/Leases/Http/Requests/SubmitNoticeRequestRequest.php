<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Documents\Enums\FileCategory;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

final class SubmitNoticeRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Le motif doit appartenir à la liste fermée de la juridiction du bail : l'Action le vérifie. Le type réel du justificatif est
     * vérifié par Documents sur le contenu.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'reason_key' => ['required', 'string', 'regex:/^[a-z_]{2,40}$/'],
            'requested_departure_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:today', 'before_or_equal:2100-12-31'],
            'forwarding_address' => ['nullable', 'string', 'max:300'],
            'consent_accepted' => ['required', 'accepted'],
            'consent_version' => ['required', 'string', 'in:'.config('leases.notice.consent_version')],
            'client_id' => ['required', 'uuid'],
            'proof' => ['nullable', 'file', 'max:'.(int) (FileCategory::Supporting->maxBytes() / 1024)],
        ];
    }

    public function proof(): ?UploadedFile
    {
        $fichier = $this->file('proof');

        return $fichier instanceof UploadedFile ? $fichier : null;
    }

    public function departureOn(): CarbonImmutable
    {
        return CarbonImmutable::parse((string) $this->validated('requested_departure_on'))->startOfDay();
    }

    public function forwardingAddress(): ?string
    {
        $adresse = $this->validated('forwarding_address');

        return is_string($adresse) && trim($adresse) !== '' ? trim($adresse) : null;
    }
}
