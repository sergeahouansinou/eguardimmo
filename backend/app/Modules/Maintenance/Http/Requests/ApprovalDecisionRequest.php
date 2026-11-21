<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Data\ApprovalDecisionData;
use App\Modules\Maintenance\Enums\ApprovalDecision;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ApprovalDecisionRequest extends FormRequest
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
            'decision' => ['required', Rule::enum(ApprovalDecision::class)],
            'comment' => ['nullable', 'string', 'max:500'],
            'proof_file_id' => ['nullable', 'uuid'],
        ];
    }

    public function toData(): ApprovalDecisionData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new ApprovalDecisionData(
            ApprovalDecision::from((string) $v['decision']),
            isset($v['comment']) ? trim((string) $v['comment']) : null,
            isset($v['proof_file_id']) ? (string) $v['proof_file_id'] : null,
        );
    }
}
