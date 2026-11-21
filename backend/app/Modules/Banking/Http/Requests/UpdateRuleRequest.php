<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Requests;

use App\Modules\Banking\Data\BankRuleData;
use App\Modules\Banking\Enums\Confidence;
use App\Modules\Banking\Enums\Direction;
use App\Modules\Banking\Enums\IgnoreReason;
use App\Modules\Banking\Enums\RuleAction;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateRuleRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:120'],
            'label_contains' => ['nullable', 'string', 'min:3', 'max:120'],
            'counterparty_line_id' => ['nullable', 'uuid'],
            'transaction_code' => ['nullable', 'string', 'max:40'],
            'amount_min' => ['nullable', 'integer', 'min:1', 'max:100000000000000'],
            'amount_max' => ['nullable', 'integer', 'min:1', 'max:100000000000000', 'gte:amount_min'],
            'direction' => ['nullable', Rule::enum(Direction::class)],
            'action' => ['required', Rule::enum(RuleAction::class)],
            'target_lease_id' => ['required_if:action,suggest_lease', 'prohibited_unless:action,suggest_lease', 'nullable', 'uuid'],
            'ignore_reason' => ['required_if:action,suggest_ignore', 'prohibited_unless:action,suggest_ignore', 'nullable', Rule::enum(IgnoreReason::class)],
            'confidence' => ['required', Rule::in(['strong', 'weak'])],
            'active' => ['nullable', 'boolean'],
            'position' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'lock_version' => ['required', 'integer', 'min:1'],
        ];
    }

    public function toData(): BankRuleData
    {
        $v = $this->validated();

        return new BankRuleData(
            trim((string) $v['name']), isset($v['label_contains']) ? trim((string) $v['label_contains']) : null, isset($v['counterparty_line_id']) ? (string) $v['counterparty_line_id'] : null,
            isset($v['transaction_code']) ? trim((string) $v['transaction_code']) : null, isset($v['amount_min']) ? (int) $v['amount_min'] : null,
            isset($v['amount_max']) ? (int) $v['amount_max'] : null, isset($v['direction']) ? Direction::from((string) $v['direction']) : null, RuleAction::from((string) $v['action']),
            isset($v['target_lease_id']) ? (string) $v['target_lease_id'] : null, isset($v['ignore_reason']) ? IgnoreReason::from((string) $v['ignore_reason']) : null,
            Confidence::from((string) $v['confidence']), (bool) ($v['active'] ?? true), isset($v['position']) ? (int) $v['position'] : null,
        );
    }
}
