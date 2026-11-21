<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Requests;

use App\Modules\Recovery\Data\OpenCaseData;
use App\Modules\Recovery\Support\ChoosesReceivables;
use Illuminate\Foundation\Http\FormRequest;

final class OpenCaseRequest extends FormRequest
{
    use ChoosesReceivables;

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
            'lease_id' => ['required', 'uuid'],
            'debtor_party_id' => ['required', 'uuid'],
            ...$this->receivableRules(),
        ];
    }

    public function toData(): OpenCaseData
    {
        return new OpenCaseData((string) $this->validated('lease_id'), (string) $this->validated('debtor_party_id'), $this->installmentIds(), $this->invoiceIds());
    }
}
