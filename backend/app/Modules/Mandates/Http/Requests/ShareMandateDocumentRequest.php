<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Requests;

use App\Modules\Mandates\Enums\MandateDocumentKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ShareMandateDocumentRequest extends FormRequest
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
            'stored_file_id' => ['required', 'uuid'],
            'kind' => ['required', Rule::enum(MandateDocumentKind::class)->except(MandateDocumentKind::Amendment)],
        ];
    }

    public function kind(): MandateDocumentKind
    {
        return MandateDocumentKind::from((string) $this->validated('kind'));
    }
}
