<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Requests;

use App\Modules\OwnerFunds\Data\NewPayoutAccountRequestData;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

final class RequestPayoutAccountChangeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'access_id' => ['required', 'uuid'],
            'iban' => ['required', 'string', 'max:42'],
            'bic' => ['nullable', 'string', 'regex:/^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/'],
            'holder_name' => ['required', 'string', 'max:200'],
            'proof' => ['required', 'file', 'max:5120', 'mimetypes:application/pdf,image/jpeg,image/png'],
        ];
    }

    public function toData(string $mandantPartyId): NewPayoutAccountRequestData
    {
        $v = $this->validated();
        $piece = $this->file('proof');

        return new NewPayoutAccountRequestData(
            $mandantPartyId,
            (string) $v['access_id'],
            (string) $v['iban'],
            isset($v['bic']) ? strtoupper((string) $v['bic']) : null,
            trim((string) $v['holder_name']),
            $piece instanceof UploadedFile ? $piece : throw new \LogicException('Pièce absente après validation.'),
        );
    }
}
