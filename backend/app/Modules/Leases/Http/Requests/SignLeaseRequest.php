<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Leases\Data\SignLeaseData;
use Illuminate\Foundation\Http\FormRequest;

final class SignLeaseRequest extends FormRequest
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
            'signed_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:2000-01-01'],
            'signed_file_id' => ['nullable', 'uuid'],
            'lock_version' => ['required', 'integer', 'min:1'],
        ];
    }

    public function toData(): SignLeaseData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new SignLeaseData(
            signedOn: (string) $v['signed_on'],
            signedFileId: isset($v['signed_file_id']) ? (string) $v['signed_file_id'] : null,
            lockVersion: (int) $v['lock_version'],
        );
    }
}
