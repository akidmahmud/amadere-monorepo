"use client";

import { useState } from "react";
import { Icon } from "@amader/admin-ui";
import { MobileRecordCard } from "@/components/MobileRecordCard";
import {
  DistrictAutocomplete,
  ThanaAutocomplete,
} from "@/components/DistrictThanaFields";
import {
  BEHAVIOUR_LABEL,
  PRIORITY_LABEL,
  PRIORITY_STYLE,
  ReadOnlyText,
  STATUS_LABEL,
  STATUS_STYLE,
  TH,
  cellInputClass,
  cellSelectStyle,
  cellSelectStyleObj,
  checkIcon,
  daysLeftColor,
  editIcon,
  eyeIcon,
  fbIcon,
  formatDate,
  scoreBadgeStyle,
  starIcon,
  toDateInputValue,
} from "@/components/customers/CustomersTable";
import { useCan } from "@/hooks/useAdminAuth";
import {
  usePatchWholesaleCustomer,
  type WholesaleCustomer,
} from "@/hooks/useWholesale";

const INK = "#1e2b22";
const TEXT = "#374840";
const FAINT = "#94a69a";
const GREEN = "#2e7d43";
const BLUE = "#2570eb";
const RED = "#e8465e";

const money = (v: string | number) =>
  `৳${Number(v || 0).toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;

const cartIcon = (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9" cy="20" r="1.2" />
    <circle cx="17" cy="20" r="1.2" />
    <path d="M3 4h2l2.2 10.3a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L20 7H6" />
  </svg>
);
const settingsIcon = (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
  </svg>
);

interface Actions {
  onView: (c: WholesaleCustomer) => void;
  onOrder: (c: WholesaleCustomer) => void;
  onEdit: (c: WholesaleCustomer) => void;
  onDelete?: (c: WholesaleCustomer) => void;
}

/**
 * The wholesale Customer Dashboard's CRM table: the same columns, look and
 * inline editing as retail Customer Management (styles shared from
 * CustomersTable), over wholesale buyers. Dropdown cells save on change; text
 * cells unlock with the row's edit icon and save on blur.
 */
export function WholesaleCustomersTable({
  customers,
  staff,
  ...actions
}: {
  customers: WholesaleCustomer[];
  staff?: { id: number; name: string }[];
} & Actions) {
  return (
    <div
      className="overflow-hidden rounded-card border shadow-[0_1px_2px_rgba(20,40,25,.05)]"
      style={{ background: "#fff", borderColor: "#e5ebe6" }}
    >
      <div className="flex flex-col gap-2.5 p-2.5 md:hidden">
        {customers.map((c) => (
          <MobileRecordCard
            key={c.id}
            onClick={() => actions.onView(c)}
            title={c.name}
            subtitle={c.phone ?? undefined}
            fields={[
              { label: "Orders", value: c.orderCount },
              { label: "Purchase", value: money(c.purchaseTotal) },
              { label: "Last order", value: formatDate(c.lastOrderAt) },
              {
                label: "Status",
                value: c.crmStatus ? STATUS_LABEL[c.crmStatus] : "",
              },
              { label: "Top product", value: c.topProduct ?? "" },
              { label: "Assigned", value: c.assignedAdminName ?? "" },
            ]}
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => actions.onOrder(c)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-border px-3 text-xs font-semibold text-text"
                >
                  <Icon name="add" size={14} /> New Order
                </button>
                <button
                  type="button"
                  onClick={() => actions.onEdit(c)}
                  className="inline-flex h-8 items-center rounded-sm border border-border px-3 text-xs font-semibold text-text"
                >
                  Edit
                </button>
                {actions.onDelete && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      actions.onDelete?.(c);
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-rose-200 px-3 text-xs font-semibold text-rose-600"
                  >
                    <Icon name="delete" size={14} /> Delete Customer
                  </button>
                )}
              </div>
            }
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table
          className="border-separate border-spacing-0"
          style={{ minWidth: 3500, width: "100%" }}
        >
          <thead>
            <tr>
              <TH sticky={1} style={{ minWidth: 200 }}>
                Name
              </TH>
              <TH>Fav</TH>
              <TH>Actions</TH>
              <TH>B-Day</TH>
              <TH style={{ minWidth: 220 }}>Address</TH>
              <TH style={{ minWidth: 150 }}>District</TH>
              <TH style={{ minWidth: 150 }}>Thana</TH>
              <TH>Phone</TH>
              <TH style={{ minWidth: 190 }}>Email</TH>
              <TH>Order Count</TH>
              <TH>Total Purchase</TH>
              <TH style={{ minWidth: 190 }}>Product</TH>
              <TH>Assign To</TH>
              <TH>Start Date</TH>
              <TH>Last Order Date</TH>
              <TH>Next Call Target</TH>
              <TH>Days Left</TH>
              <TH>Expire Time</TH>
              <TH>New Order</TH>
              <TH>New Order Date</TH>
              <TH>Priority</TH>
              <TH>Status</TH>
              <TH>Behaviour</TH>
              <TH style={{ minWidth: 210 }}>Customer Feedback</TH>
              <TH style={{ minWidth: 210 }}>Amader Feedback</TH>
              <TH style={{ minWidth: 210 }}>Customer Family Details</TH>
              <TH style={{ minWidth: 190 }}>Purchase Reason</TH>
              <TH>F Score</TH>
              <TH>M Score</TH>
              <TH>RFM Score</TH>
              <TH>Facebook Profile</TH>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <WholesaleCustomerRow
                key={c.id}
                customer={c}
                staff={staff}
                {...actions}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WholesaleCustomerRow({
  customer: c,
  staff,
  onView,
  onOrder,
  onEdit,
  onDelete,
}: {
  customer: WholesaleCustomer;
  staff?: { id: number; name: string }[];
} & Actions) {
  const update = usePatchWholesaleCustomer(c.id);
  const canAssign = useCan("assignment.manage");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const [address, setAddress] = useState(c.address ?? "");
  const [district, setDistrict] = useState(c.district ?? "");
  const [thana, setThana] = useState(c.thana ?? "");
  const [phone, setPhone] = useState(c.phone ?? "");
  const [email, setEmail] = useState(c.email ?? "");
  const [feedback, setFeedback] = useState(c.customerFeedback ?? "");
  const [amaderFeedback, setAmaderFeedback] = useState(c.amaderFeedback ?? "");
  const [family, setFamily] = useState(c.familyDetails ?? "");
  const [reason, setReason] = useState(c.purchaseReason ?? "");
  const [fbUrl, setFbUrl] = useState(c.facebookProfileUrl ?? "");

  const daysLeft = c.nextCallTarget
    ? Math.ceil(
        (new Date(c.nextCallTarget).getTime() - Date.now()) / 86_400_000,
      )
    : null;
  const priorityStyle = PRIORITY_STYLE[c.priority ?? "MEDIUM"];
  const statusStyle = STATUS_STYLE[c.crmStatus ?? "NOT_STARTED"];

  const td =
    "px-3 py-[11px] text-[0.76rem] font-semibold whitespace-nowrap align-middle border-b";
  const tdStyle = {
    color: TEXT,
    borderColor: "#eef3ef",
    background: "#fff",
  } as const;

  // A text cell: an input while the row is being edited (saved on blur when
  // changed), read-only text otherwise.
  const textCell = (
    value: string,
    set: (v: string) => void,
    original: string | null,
    save: (v: string) => void,
    placeholder: string,
    width: number,
  ) =>
    editing ? (
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        onBlur={() => value !== (original ?? "") && save(value)}
        placeholder={placeholder}
        className={cellInputClass}
        style={{ width }}
      />
    ) : (
      <ReadOnlyText value={value} placeholder={placeholder} width={width} />
    );

  const dateCell = (value: string | null, save: (v: string | null) => void) =>
    editing ? (
      <input
        type="date"
        defaultValue={toDateInputValue(value)}
        onChange={(e) => save(e.target.value || null)}
        className={cellInputClass}
        style={{ width: 140 }}
      />
    ) : (
      <ReadOnlyText value={formatDate(value)} width={140} />
    );

  const iconButton =
    "grid h-[29px] w-[29px] place-items-center rounded-[8px] border border-transparent hover:border-[#e5ebe6]";

  return (
    <tr className="[&:hover>td]:bg-[#f7fbf8]">
      <td
        className={td}
        style={{
          ...tdStyle,
          position: "sticky",
          left: 0,
          zIndex: 6,
          boxShadow: "6px 0 8px -6px rgba(20,40,25,.14)",
        }}
      >
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() =>
              name.trim() &&
              name !== c.name &&
              update.mutate({ name: name.trim() })
            }
            className="h-[26px] w-[170px] rounded-[7px] border border-transparent bg-transparent px-1.5 font-bold outline-none hover:border-[#e5ebe6] hover:bg-white focus:border-[#2e7d43] focus:bg-white"
            style={{ color: INK }}
          />
        ) : (
          <span
            role="button"
            tabIndex={0}
            onClick={() => onView(c)}
            onKeyDown={(e) => e.key === "Enter" && onView(c)}
            className="block w-[170px] cursor-pointer truncate px-1.5 font-bold hover:underline"
            style={{ color: INK }}
            title={name}
          >
            {name}
          </span>
        )}
        <button
          type="button"
          onClick={() => onView(c)}
          className="mt-[3px] block px-1.5 text-[0.66rem] font-medium hover:underline"
          style={{ color: FAINT }}
        >
          #WS-{c.id}
          {!c.isActive ? " · Inactive" : ""}
          {Number(c.due) > 0 ? ` · ${money(c.due)} due` : ""}
        </button>
      </td>
      <td className={td} style={tdStyle}>
        <button
          type="button"
          onClick={() => update.mutate({ isFavorite: !c.isFavorite })}
          aria-label="Toggle favorite"
        >
          {starIcon(c.isFavorite)}
        </button>
      </td>
      <td className={td} style={tdStyle}>
        <div className="flex items-center gap-[5px]">
          <button
            type="button"
            onClick={() => onView(c)}
            aria-label="View full history"
            title="View Full History"
            className={iconButton}
            style={{ color: FAINT }}
          >
            {eyeIcon}
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-label={editing ? "Done editing" : "Edit in table"}
            title={editing ? "Done editing" : "Edit in table"}
            className="grid h-[29px] w-[29px] place-items-center rounded-[8px] border"
            style={
              editing
                ? { color: GREEN, borderColor: GREEN, background: "#e3f4e6" }
                : { color: FAINT, borderColor: "transparent" }
            }
          >
            {editing ? checkIcon : editIcon}
          </button>
          <button
            type="button"
            onClick={() => onOrder(c)}
            aria-label="New order"
            title="New Order"
            className={iconButton}
            style={{ color: FAINT }}
          >
            {cartIcon}
          </button>
          <button
            type="button"
            onClick={() => onEdit(c)}
            aria-label="Edit details"
            title="Edit details (credit, landmark, note…)"
            className={iconButton}
            style={{ color: FAINT }}
          >
            {settingsIcon}
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(c)}
              aria-label="Delete Customer"
              title="Delete Customer"
              className={iconButton}
              style={{ color: RED }}
            >
              <Icon name="delete" size={15} />
            </button>
          )}
        </div>
      </td>
      <td className={td} style={tdStyle}>
        {dateCell(c.dob, (dob) => update.mutate({ dob }))}
      </td>
      <td className={td} style={tdStyle}>
        {textCell(
          address,
          setAddress,
          c.address,
          (v) => update.mutate({ address: v }),
          "Add address...",
          220,
        )}
      </td>
      <td className={td} style={tdStyle}>
        {editing ? (
          <div style={{ width: 150 }}>
            <DistrictAutocomplete
              value={district}
              onChange={(next) => {
                setDistrict(next);
                setThana("");
                update.mutate({ district: next, thana: "" });
              }}
            />
          </div>
        ) : (
          <ReadOnlyText
            value={district}
            placeholder="এখানে জেলা টাইপ করুন"
            width={150}
          />
        )}
      </td>
      <td className={td} style={tdStyle}>
        {editing ? (
          <div
            style={{ width: 150 }}
            onBlur={() => thana !== (c.thana ?? "") && update.mutate({ thana })}
          >
            <ThanaAutocomplete
              district={district}
              value={thana}
              onChange={setThana}
            />
          </div>
        ) : (
          <ReadOnlyText
            value={thana}
            placeholder="এখানে থানা টাইপ করুন"
            width={150}
          />
        )}
      </td>
      <td className={td} style={tdStyle}>
        {/* A shop's landline is allowed, as in the customer form — only an empty phone is refused. */}
        {textCell(
          phone,
          setPhone,
          c.phone,
          (v) => v.trim() && update.mutate({ phone: v.trim() }),
          "Phone",
          130,
        )}
      </td>
      <td className={td} style={tdStyle}>
        {textCell(
          email,
          setEmail,
          c.email,
          (v) => update.mutate({ email: v }),
          "Email",
          190,
        )}
      </td>
      <td className={td} style={{ ...tdStyle, fontWeight: 700, color: INK }}>
        {c.orderCount}
        {c.orderCount > 0 && (
          <span
            className="ml-1.5 text-[0.66rem] font-medium"
            style={{ color: FAINT }}
          >
            {c.wholesaleCount} WS · {c.channelCount} channel
          </span>
        )}
      </td>
      <td className={td} style={{ ...tdStyle, fontWeight: 700, color: INK }}>
        {money(c.purchaseTotal)}
        {Number(c.due) > 0 && (
          <span className="block text-[0.66rem]" style={{ color: RED }}>
            {money(c.due)} due
          </span>
        )}
      </td>
      <td className={td} style={tdStyle}>
        <span
          className="block overflow-hidden text-ellipsis whitespace-nowrap"
          style={{ maxWidth: 190 }}
          title={c.topProduct ?? undefined}
        >
          {c.topProduct ?? "—"}
        </span>
      </td>
      <td className={td} style={tdStyle}>
        <select
          value={c.assignedAdminId ?? ""}
          disabled={!canAssign}
          title={
            canAssign
              ? undefined
              : "You do not have permission to reassign customers"
          }
          onChange={(e) =>
            update.mutate({
              assignedAdminId: e.target.value ? Number(e.target.value) : null,
            })
          }
          className={cellSelectStyle}
          style={cellSelectStyleObj}
        >
          <option value="">—</option>
          {(staff ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </td>
      <td className={td} style={tdStyle}>
        {formatDate(c.createdAt)}
      </td>
      <td className={td} style={{ ...tdStyle, fontWeight: 700, color: INK }}>
        {formatDate(c.lastOrderAt)}
      </td>
      <td className={td} style={tdStyle}>
        {dateCell(c.nextCallTarget, (nextCallTarget) =>
          update.mutate({ nextCallTarget }),
        )}
      </td>
      <td className={td} style={tdStyle}>
        {daysLeft !== null ? (
          <span
            className="font-extrabold"
            style={{ color: daysLeftColor(daysLeft) }}
          >
            {daysLeft}
          </span>
        ) : (
          <span style={{ color: FAINT }}>—</span>
        )}
      </td>
      <td className={td} style={tdStyle}>
        <select
          value={c.followUpCadenceDays ?? ""}
          onChange={(e) =>
            update.mutate({
              followUpCadenceDays: e.target.value
                ? Number(e.target.value)
                : null,
            })
          }
          className={cellSelectStyle}
          style={cellSelectStyleObj}
        >
          <option value="">—</option>
          <option value={7}>7 days</option>
          <option value={15}>15 days</option>
          <option value={30}>30 days</option>
        </select>
      </td>
      <td className={td} style={tdStyle}>
        <select
          value={c.hasNewOrder ? "yes" : "no"}
          onChange={(e) =>
            update.mutate({ hasNewOrder: e.target.value === "yes" })
          }
          className={cellSelectStyle}
          style={cellSelectStyleObj}
        >
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </td>
      <td className={td} style={{ ...tdStyle, color: FAINT, fontWeight: 500 }}>
        {c.hasNewOrder
          ? dateCell(c.newOrderAt, (newOrderAt) =>
              update.mutate({ newOrderAt }),
            )
          : "—"}
      </td>
      <td className={td} style={tdStyle}>
        <select
          value={c.priority ?? "MEDIUM"}
          onChange={(e) =>
            update.mutate({
              priority: e.target.value as WholesaleCustomer["priority"],
            })
          }
          className={cellSelectStyle}
          style={{
            background: priorityStyle.bg,
            borderColor: priorityStyle.border,
            color: priorityStyle.color,
          }}
        >
          {Object.entries(PRIORITY_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </td>
      <td className={td} style={tdStyle}>
        <select
          value={c.crmStatus ?? "NOT_STARTED"}
          onChange={(e) =>
            update.mutate({
              crmStatus: e.target.value as WholesaleCustomer["crmStatus"],
            })
          }
          className={cellSelectStyle}
          style={{
            background: statusStyle.bg,
            borderColor: statusStyle.border,
            color: statusStyle.color,
          }}
        >
          {Object.entries(STATUS_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </td>
      <td className={td} style={tdStyle}>
        <select
          value={c.behaviour ?? ""}
          onChange={(e) =>
            update.mutate({
              behaviour: (e.target.value ||
                null) as WholesaleCustomer["behaviour"],
            })
          }
          className={cellSelectStyle}
          style={cellSelectStyleObj}
        >
          <option value="">—</option>
          {Object.entries(BEHAVIOUR_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </td>
      <td className={td} style={tdStyle}>
        {textCell(
          feedback,
          setFeedback,
          c.customerFeedback,
          (v) => update.mutate({ customerFeedback: v }),
          "Add feedback...",
          190,
        )}
      </td>
      <td className={td} style={tdStyle}>
        {textCell(
          amaderFeedback,
          setAmaderFeedback,
          c.amaderFeedback,
          (v) => update.mutate({ amaderFeedback: v }),
          "Add note...",
          190,
        )}
      </td>
      <td className={td} style={tdStyle}>
        {textCell(
          family,
          setFamily,
          c.familyDetails,
          (v) => update.mutate({ familyDetails: v }),
          "Add details...",
          190,
        )}
      </td>
      <td className={td} style={tdStyle}>
        {textCell(
          reason,
          setReason,
          c.purchaseReason,
          (v) => update.mutate({ purchaseReason: v }),
          "Reason...",
          150,
        )}
      </td>
      {[c.fScore, c.mScore].map((score, i) => (
        <td key={i} className={td} style={tdStyle}>
          <span
            className="inline-flex h-6 min-w-[26px] items-center justify-center rounded-[7px] px-[7px] text-[0.7rem] font-extrabold"
            style={{
              background: scoreBadgeStyle(score).bg,
              color: scoreBadgeStyle(score).color,
            }}
          >
            {score}
          </span>
        </td>
      ))}
      <td className={td} style={tdStyle}>
        <span
          className="inline-flex h-6 min-w-[26px] items-center justify-center rounded-[7px] px-[7px] text-[0.7rem] font-extrabold text-white"
          style={{ background: GREEN }}
        >
          {c.rfmScore}
        </span>
      </td>
      <td className={td} style={tdStyle}>
        <div className="flex items-center gap-1.5">
          {textCell(
            fbUrl,
            setFbUrl,
            c.facebookProfileUrl,
            (v) => update.mutate({ facebookProfileUrl: v }),
            "Profile URL...",
            130,
          )}
          {c.facebookProfileUrl && (
            <a
              href={c.facebookProfileUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: BLUE }}
              aria-label="Open Facebook profile"
            >
              {fbIcon}
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}
