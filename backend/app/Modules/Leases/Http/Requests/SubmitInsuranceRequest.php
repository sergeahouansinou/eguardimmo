<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Documents\Enums\FileCategory;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

final class SubmitInsuranceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Le type réel du fichier est vérifié par Documents sur le contenu ; ici, seulement présence et taille.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:'.(int) (FileCategory::Certificate->maxBytes() / 1024)],
            'insurer' => ['required', 'string', 'min:2', 'max:120'],
            'policy_number' => ['required', 'string', 'min:2', 'max:60'],
            'starts_on' => ['required', 'date_format:Y-m-d'],
            'ends_on' => ['required', 'date_format:Y-m-d'],
            'client_id' => ['required', 'uuid'],
        ];
    }

    public function uploaded(): UploadedFile
    {
        $fichier = $this->file('file');

        return $fichier instanceof UploadedFile ? $fichier : throw new \LogicException('Fichier validé absent.');
    }

    public function startsOn(): CarbonImmutable
    {
        return CarbonImmutable::parse((string) $this->validated('starts_on'))->startOfDay();
    }

    public function endsOn(): CarbonImmutable
    {
        return CarbonImmutable::parse((string) $this->validated('ends_on'))->startOfDay();
    }
}
